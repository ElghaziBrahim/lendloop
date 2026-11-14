import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { todayIso } from "./lib/dates";
import {
  readSignatureHeaders,
  verifyAutomationSignature,
} from "./lib/signing";

/**
 * The signed HTTP surface for n8n.
 *
 * Both endpoints verify the same contract as `convex/lib/signing.ts`:
 * HMAC-SHA256 hex of `${timestamp}.${rawBody}`, carried in
 * `x-lendloop-timestamp` (epoch milliseconds) and `x-lendloop-signature`, and
 * rejected when the timestamp is more than five minutes from this server's
 * clock. The body is read as text *before* parsing, because the signature
 * covers the exact bytes n8n sent, not a re-serialized object.
 *
 * These routes are not CORS endpoints and not for the browser: n8n is a
 * server-side caller.
 */

const http = httpRouter();

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function signingSecret(): string | null {
  const secret = process.env.N8N_HMAC_SECRET;
  return typeof secret === "string" && secret.length > 0 ? secret : null;
}

type Authorization = { ok: true } | { ok: false; response: Response };

/**
 * Verify the signature, or build the 401.
 *
 * A missing secret is a 500, never a bypass: an unconfigured deployment must
 * fail closed.
 */
async function authorize(request: Request, body: string): Promise<Authorization> {
  const secret = signingSecret();
  if (!secret) {
    return {
      ok: false,
      response: json(
        {
          error: "not_configured",
          message: "N8N_HMAC_SECRET is not set on this deployment.",
        },
        500,
      ),
    };
  }

  const { timestamp, signature } = readSignatureHeaders(request.headers);
  const check = await verifyAutomationSignature({
    secret,
    timestamp,
    signature,
    body,
  });

  if (!check.ok) {
    return {
      ok: false,
      response: json({ error: "unauthorized", reason: check.reason }, 401),
    };
  }
  return { ok: true };
}

/**
 * GET /n8n/overdue
 *
 * The signed equivalent of the admin `loans.overdue` query: every past-due,
 * unreturned loan as of today (UTC). The body is empty, so the signed string is
 * `${timestamp}.`.
 */
http.route({
  path: "/n8n/overdue",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const authorization = await authorize(request, body);
    if (!authorization.ok) return authorization.response;

    const asOf = todayIso();
    const loans = await ctx.runQuery(internal.loans.overdueForAutomation, {
      asOf,
    });

    return json({ asOf, count: loans.length, loans }, 200);
  }),
});

type ReminderKind = "due_soon" | "overdue";
type ReminderOutcome = "sent" | "failed";

type ReminderResultInput = {
  idempotencyKey: string;
  loanId: string;
  kind: ReminderKind;
  status: ReminderOutcome;
  sentAt?: number;
  error?: string;
};

type ParsedReminderResult =
  | { ok: true; value: ReminderResultInput }
  | { ok: false; message: string };

const MAX_IDEMPOTENCY_KEY = 200;
const MAX_ERROR_LENGTH = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Shape validation before the mutation runs. Convex validators would reject a
 * malformed argument with a 500; here a bad payload is a 400 the n8n workflow
 * can branch on.
 */
function parseReminderResult(payload: unknown): ParsedReminderResult {
  if (!isRecord(payload)) {
    return { ok: false, message: "The body must be a JSON object." };
  }

  const idempotencyKey =
    typeof payload.idempotencyKey === "string"
      ? payload.idempotencyKey.trim()
      : "";
  if (idempotencyKey.length === 0 || idempotencyKey.length > MAX_IDEMPOTENCY_KEY) {
    return {
      ok: false,
      message: `idempotencyKey must be 1-${MAX_IDEMPOTENCY_KEY} characters.`,
    };
  }

  const loanId = typeof payload.loanId === "string" ? payload.loanId.trim() : "";
  if (loanId.length === 0) {
    return { ok: false, message: "loanId is required." };
  }

  const kind = payload.kind;
  if (kind !== "due_soon" && kind !== "overdue") {
    return { ok: false, message: 'kind must be "due_soon" or "overdue".' };
  }

  const status = payload.status;
  if (status !== "sent" && status !== "failed") {
    return { ok: false, message: 'status must be "sent" or "failed".' };
  }

  let sentAt: number | undefined;
  if (payload.sentAt !== undefined && payload.sentAt !== null) {
    if (
      typeof payload.sentAt !== "number" ||
      !Number.isFinite(payload.sentAt) ||
      payload.sentAt <= 0
    ) {
      return {
        ok: false,
        message: "sentAt must be a positive epoch-milliseconds number.",
      };
    }
    sentAt = Math.floor(payload.sentAt);
  }

  let error: string | undefined;
  if (payload.error !== undefined && payload.error !== null) {
    if (typeof payload.error !== "string") {
      return { ok: false, message: "error must be a string." };
    }
    error = payload.error.trim().slice(0, MAX_ERROR_LENGTH);
  }

  return {
    ok: true,
    value: { idempotencyKey, loanId, kind, status, sentAt, error },
  };
}

/**
 * POST /n8n/reminder-result
 *
 * n8n reports the outcome of one reminder. The write-back is idempotent on
 * `idempotencyKey`: a replay returns `duplicate: true` with the first call's
 * ids and writes nothing.
 */
http.route({
  path: "/n8n/reminder-result",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const authorization = await authorize(request, body);
    if (!authorization.ok) return authorization.response;

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const parsed = parseReminderResult(payload);
    if (!parsed.ok) {
      return json({ error: "invalid_payload", message: parsed.message }, 400);
    }

    const result = await ctx.runMutation(
      internal.automationStore.recordReminderResult,
      parsed.value,
    );

    if (result.code !== null) {
      const status = result.code === "LOAN_NOT_FOUND" ? 404 : 400;
      return json({ ok: false, error: result.code }, status);
    }

    return json(
      {
        ok: true,
        duplicate: result.duplicate,
        reminderId: result.reminderId,
        eventId: result.eventId,
      },
      200,
    );
  }),
});

export default http;
