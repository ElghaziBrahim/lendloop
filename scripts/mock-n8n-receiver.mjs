#!/usr/bin/env node
/**
 * Mock n8n receiver and scripted checks for LendLoop's signed automation.
 *
 * This file is the reference implementation of the inbound side of the
 * contract, and the harness the acceptance checks run against:
 *
 * - Canonical string: `${timestamp}.${body}` (body is the exact raw text)
 * - `x-lendloop-timestamp`: Unix epoch milliseconds, 13 digits
 * - `x-lendloop-signature`: lowercase hex HMAC-SHA256
 * - Rejected when the timestamp is more than five minutes from this clock
 *
 * Modes:
 *
 *   node scripts/mock-n8n-receiver.mjs
 *     Run the receiver on --port (default 8787), verify incoming events and log
 *     a one-line summary. Point N8N_REQUEST_WEBHOOK_URL at
 *     http://127.0.0.1:8787/n8n/request to test the outbound action locally.
 *
 *   node scripts/mock-n8n-receiver.mjs --self-test
 *     Start a throwaway server on an ephemeral port and prove that a genuine
 *     signature is accepted while a tampered body, a stale timestamp, a future
 *     timestamp and an unsigned request are rejected. No Convex needed.
 *
 *   N8N_HMAC_SECRET=... node scripts/mock-n8n-receiver.mjs \
 *     --convex-site https://<deployment>.convex.site
 *     Check the live Convex endpoints: unsigned /n8n/overdue gets 401, a signed
 *     call gets 200, and replaying one reminder-result key returns
 *     `duplicate: true` the second time.
 *
 * The secret is read from N8N_HMAC_SECRET (or --secret). It is never printed.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import process from "node:process";

const TIMESTAMP_HEADER = "x-lendloop-timestamp";
const SIGNATURE_HEADER = "x-lendloop-signature";
const TOLERANCE_MS = 5 * 60_000;
const TIMESTAMP_PATTERN = /^\d{13}$/;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;
const MAX_BODY_BYTES = 1_000_000;

function expectedSignature(secret, timestamp, body) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");
}

/** Length is public; compare the digest itself in constant time. */
function signaturesMatch(expected, received) {
  if (!SIGNATURE_PATTERN.test(received)) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function verify(secret, headers, body, nowMs = Date.now()) {
  const timestamp = headers[TIMESTAMP_HEADER];
  const signature = headers[SIGNATURE_HEADER];

  if (!timestamp) return { ok: false, reason: "missing_timestamp" };
  if (!signature) return { ok: false, reason: "missing_signature" };
  if (!TIMESTAMP_PATTERN.test(timestamp)) {
    return { ok: false, reason: "malformed_timestamp" };
  }
  if (Math.abs(nowMs - Number(timestamp)) > TOLERANCE_MS) {
    return { ok: false, reason: "timestamp_out_of_window" };
  }
  if (!SIGNATURE_PATTERN.test(signature.trim().toLowerCase())) {
    return { ok: false, reason: "malformed_signature" };
  }

  const expected = expectedSignature(secret, timestamp, body);
  return signaturesMatch(expected, signature.trim().toLowerCase())
    ? { ok: true }
    : { ok: false, reason: "signature_mismatch" };
}

function sign(secret, body, timestamp = String(Date.now())) {
  return {
    timestamp,
    signature: expectedSignature(secret, timestamp, body),
  };
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body_too_large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function createReceiver({ secret, label = "mock-n8n" }) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true, service: label });
      return;
    }

    if (request.method !== "POST" || url.pathname !== "/n8n/request") {
      sendJson(response, 404, { ok: false, error: "not_found" });
      return;
    }

    let raw;
    try {
      raw = await readBody(request);
    } catch {
      sendJson(response, 413, { ok: false, error: "body_too_large" });
      return;
    }

    const check = verify(secret, request.headers, raw);
    if (!check.ok) {
      console.log(`[${label}] rejected ${request.socket.remoteAddress}: ${check.reason}`);
      sendJson(response, 401, { ok: false, error: "unauthorized", reason: check.reason });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      sendJson(response, 400, { ok: false, error: "invalid_json" });
      return;
    }

    const requestId = typeof payload?.requestId === "string" ? payload.requestId : null;
    const idempotencyKey =
      typeof payload?.idempotencyKey === "string" ? payload.idempotencyKey : null;
    const tool = payload?.tool?.name ?? "unknown tool";
    const borrower = payload?.borrower?.email ?? payload?.borrower?.name ?? "unknown borrower";

    console.log(
      `[${label}] accepted ${payload?.event ?? "event"} requestId=${requestId} ` +
        `key=${idempotencyKey} tool="${tool}" borrower="${borrower}"`,
    );

    sendJson(response, 200, {
      ok: true,
      received: payload?.event ?? "unknown",
      requestId,
      idempotencyKey,
    });
  });
}

function listen(server, port, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

function parseArgs(argv) {
  const args = { port: 8787, selfTest: false, convexSite: null, secret: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--self-test") args.selfTest = true;
    else if (arg === "--port") args.port = Number(argv[++index]);
    else if (arg === "--convex-site") args.convexSite = argv[++index];
    else if (arg === "--secret") args.secret = argv[++index];
    else if (arg === "--help" || arg === "-h") args.help = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

async function post(baseUrl, path, body, headers) {
  return await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: headers ?? {},
    body,
  });
}

async function selfTest() {
  const secret = "lendloop-self-test-secret";
  const server = createReceiver({ secret, label: "self-test" });
  const port = await listen(server, 0);
  const baseUrl = `http://127.0.0.1:${port}`;
  const body = JSON.stringify({
    event: "request.created",
    requestId: "self-test-request",
    idempotencyKey: "request-notification:self-test-request",
    tool: { name: "Cordless drill", category: "Power tools" },
    borrower: { name: "Sam", email: "sam@example.com" },
    owner: { name: "Rae", email: "rae@example.com" },
    startDate: "2026-11-14",
    endDate: "2026-11-16",
    message: null,
    createdAt: 1763000000000,
  });
  const signerHeaders = (timestamp) => {
    const signed = sign(secret, body, timestamp);
    return {
      "content-type": "application/json",
      [TIMESTAMP_HEADER]: signed.timestamp,
      [SIGNATURE_HEADER]: signed.signature,
    };
  };

  const results = [];
  const check = async (name, expectedStatus, run) => {
    const response = await run();
    const payload = await response.json().catch(() => ({}));
    const pass = response.status === expectedStatus;
    results.push({ name, expectedStatus, actualStatus: response.status, pass, payload });
    console.log(
      `${pass ? "PASS" : "FAIL"} ${name}: expected ${expectedStatus}, got ${response.status}` +
        (payload.reason ? ` (${payload.reason})` : ""),
    );
  };

  try {
    await check("genuine signature is accepted", 200, () =>
      post(baseUrl, "/n8n/request", body, signerHeaders()),
    );

    await check("tampered body is rejected", 401, async () => {
      const headers = signerHeaders();
      const tampered = body.replace("Cordless drill", "Cordless drill X");
      return await post(baseUrl, "/n8n/request", tampered, headers);
    });

    await check("stale timestamp is rejected", 401, () =>
      post(
        baseUrl,
        "/n8n/request",
        body,
        signerHeaders(String(Date.now() - 6 * 60_000)),
      ),
    );

    await check("future timestamp is rejected", 401, () =>
      post(
        baseUrl,
        "/n8n/request",
        body,
        signerHeaders(String(Date.now() + 6 * 60_000)),
      ),
    );

    await check("unsigned request is rejected", 401, () =>
      post(baseUrl, "/n8n/request", body, { "content-type": "application/json" }),
    );
  } finally {
    await close(server);
  }

  const failed = results.filter((result) => !result.pass);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed.`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

async function checkConvex(siteUrl, secret) {
  const base = siteUrl.replace(/\/$/, "");
  const overdueBody = "";

  console.log(`Checking ${base} ...`);

  const unsigned = await fetch(new URL("/n8n/overdue", base), { method: "GET" });
  const unsignedBody = await unsigned.json().catch(() => ({}));
  const unsignedPass = unsigned.status === 401;
  console.log(
    `${unsignedPass ? "PASS" : "FAIL"} unsigned /n8n/overdue: expected 401, got ${unsigned.status}` +
      (unsignedBody.reason ? ` (${unsignedBody.reason})` : ""),
  );

  const signedOverdue = sign(secret, overdueBody);
  const overdue = await fetch(new URL("/n8n/overdue", base), {
    method: "GET",
    headers: {
      [TIMESTAMP_HEADER]: signedOverdue.timestamp,
      [SIGNATURE_HEADER]: signedOverdue.signature,
    },
  });
  const overdueBodyJson = await overdue.json().catch(() => ({}));
  const overduePass = overdue.status === 200 && Array.isArray(overdueBodyJson.loans);
  console.log(
    `${overduePass ? "PASS" : "FAIL"} signed /n8n/overdue: expected 200 + loans[], got ${overdue.status}` +
      (overduePass ? ` (${overdueBodyJson.count} overdue)` : ""),
  );

  let replayPass = true;
  const loans = Array.isArray(overdueBodyJson.loans) ? overdueBodyJson.loans : [];
  if (loans.length === 0) {
    console.log(
      "SKIP replay check: no overdue loans on this deployment, so there is nothing to write a reminder against.",
    );
  } else {
    const loanId = loans[0].loanId;
    const key = `check-${Date.now()}-${process.pid}`;
    const reminderBody = JSON.stringify({
      idempotencyKey: key,
      loanId,
      kind: "overdue",
      status: "sent",
      sentAt: Date.now(),
    });
    const signedReminder = sign(secret, reminderBody);

    const first = await post(base, "/n8n/reminder-result", reminderBody, {
      "content-type": "application/json",
      [TIMESTAMP_HEADER]: signedReminder.timestamp,
      [SIGNATURE_HEADER]: signedReminder.signature,
    });
    const firstJson = await first.json().catch(() => ({}));

    // A fresh signature: the replay must be rejected by the idempotency ledger,
    // not by the five-minute window.
    const replayBody = reminderBody;
    const replaySign = sign(secret, replayBody);
    const replay = await post(base, "/n8n/reminder-result", replayBody, {
      "content-type": "application/json",
      [TIMESTAMP_HEADER]: replaySign.timestamp,
      [SIGNATURE_HEADER]: replaySign.signature,
    });
    const replayJson = await replay.json().catch(() => ({}));

    replayPass =
      first.status === 200 &&
      firstJson.ok === true &&
      firstJson.duplicate === false &&
      replay.status === 200 &&
      replayJson.ok === true &&
      replayJson.duplicate === true &&
      replayJson.reminderId === firstJson.reminderId;
    console.log(
      `${replayPass ? "PASS" : "FAIL"} reminder-result replay: first duplicate=${firstJson.duplicate}, ` +
        `second duplicate=${replayJson.duplicate}, reminderId matched=${replayJson.reminderId === firstJson.reminderId}`,
    );
  }

  if (!unsignedPass || !overduePass || !replayPass) process.exitCode = 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      "Usage: node scripts/mock-n8n-receiver.mjs [--port 8787 | --self-test | --convex-site URL] [--secret S]",
    );
    return;
  }

  const secret = args.secret ?? process.env.N8N_HMAC_SECRET;

  if (args.selfTest) {
    await selfTest();
    return;
  }

  if (!secret) {
    console.error(
      "N8N_HMAC_SECRET is not set. Set it in the environment (or pass --secret) so the receiver can verify signatures.",
    );
    process.exitCode = 2;
    return;
  }

  if (args.convexSite) {
    await checkConvex(args.convexSite, secret);
    return;
  }

  const server = createReceiver({ secret });
  const port = await listen(server, args.port);
  console.log(`Mock n8n receiver on http://127.0.0.1:${port}/n8n/request`);
  console.log("Press Ctrl+C to stop. Secret is loaded and never printed.");

  const shutdown = async () => {
    await close(server);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

await main();
