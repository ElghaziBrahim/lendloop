/**
 * HMAC request signing shared by the outbound action, the signed HTTP
 * endpoints and the mock n8n receiver.
 *
 * The contract, in one place:
 *
 * - Canonical string: `` `${timestamp}.${body}` ``
 * - `timestamp`: Unix epoch **milliseconds** as decimal text (13 digits today)
 * - `body`: the exact request body bytes as UTF-8 text. Empty string for a GET.
 * - Headers: `x-lendloop-timestamp` and `x-lendloop-signature`
 * - Signature: lowercase hex HMAC-SHA256 of the canonical string
 *
 * Signing over the timestamp as well as the body is what makes a captured
 * signature expire: the body alone would stay valid forever.
 *
 * `crypto.subtle` exists in Convex's default V8 runtime and in Node 18+, so the
 * same code signs in production, in `convex-test` and in the mock receiver.
 */

export const TIMESTAMP_HEADER = "x-lendloop-timestamp";
export const SIGNATURE_HEADER = "x-lendloop-signature";

/** Reject a timestamp more than five minutes away from this server's clock. */
export const SIGNATURE_TOLERANCE_MS = 5 * 60_000;

const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;
const TIMESTAMP_PATTERN = /^\d{13}$/;

export type SignatureFailure =
  | "missing_timestamp"
  | "missing_signature"
  | "malformed_timestamp"
  | "timestamp_out_of_window"
  | "malformed_signature"
  | "signature_mismatch";

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: SignatureFailure };

export function canonicalString(timestamp: string, body: string): string {
  return `${timestamp}.${body}`;
}

/**
 * Constant-time string comparison.
 *
 * Length is XORed into the accumulator instead of short-circuiting, and every
 * character position is visited even when the lengths differ. Signature
 * strings are fixed-length hex, so the length check leaks nothing anyway, but
 * keeping one branch-free path avoids a future caller assuming a fast exit.
 */
export function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) | 0) ^ (right.charCodeAt(index) | 0);
  }
  return difference === 0;
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return toHex(new Uint8Array(signature));
}

/** Sign a payload exactly the way the endpoints verify it. */
export async function signAutomationRequest(args: {
  secret: string;
  timestamp: string;
  body: string;
}): Promise<string> {
  return await hmacSha256Hex(
    args.secret,
    canonicalString(args.timestamp, args.body),
  );
}

/**
 * Verify a signature from request headers.
 *
 * `timestamp` and `signature` are `null` when the header is absent, so a caller
 * can distinguish "not signed at all" from "signed incorrectly" in its logs and
 * in the response body.
 */
export async function verifyAutomationSignature(args: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  body: string;
  nowMs?: number;
  toleranceMs?: number;
}): Promise<SignatureCheck> {
  if (!args.timestamp) return { ok: false, reason: "missing_timestamp" };
  if (!args.signature) return { ok: false, reason: "missing_signature" };

  if (
    !TIMESTAMP_PATTERN.test(args.timestamp) ||
    !Number.isSafeInteger(Number(args.timestamp))
  ) {
    return { ok: false, reason: "malformed_timestamp" };
  }

  const toleranceMs = args.toleranceMs ?? SIGNATURE_TOLERANCE_MS;
  const nowMs = args.nowMs ?? Date.now();
  if (Math.abs(nowMs - Number(args.timestamp)) > toleranceMs) {
    return { ok: false, reason: "timestamp_out_of_window" };
  }

  const received = args.signature.trim().toLowerCase();
  if (!SIGNATURE_PATTERN.test(received)) {
    return { ok: false, reason: "malformed_signature" };
  }

  const expected = await signAutomationRequest({
    secret: args.secret,
    timestamp: args.timestamp,
    body: args.body,
  });

  return constantTimeEqual(expected, received)
    ? { ok: true }
    : { ok: false, reason: "signature_mismatch" };
}

/** Read the two signing headers from a request. */
export function readSignatureHeaders(headers: Headers): {
  timestamp: string | null;
  signature: string | null;
} {
  return {
    timestamp: headers.get(TIMESTAMP_HEADER),
    signature: headers.get(SIGNATURE_HEADER),
  };
}
