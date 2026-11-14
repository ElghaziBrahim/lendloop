/// <reference types="vite/client" />
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { convexTest } from "convex-test";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  ADMIN_EMAIL,
  BORROWER_EMAIL,
  isoDay,
  OTHER_EMAIL,
  OWNER_EMAIL,
  seedLoan,
  seedRequest,
  seedTool,
  seedUser,
  signIn,
} from "./lib/fixtures";
import {
  constantTimeEqual,
  SIGNATURE_HEADER,
  signAutomationRequest,
  TIMESTAMP_HEADER,
  verifyAutomationSignature,
} from "./lib/signing";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const TEST_SECRET = "lendloop-test-hmac-secret";

function setup() {
  return convexTest(schema, modules);
}

type TestConvex = ReturnType<typeof setup>;

async function seedOverdue(t: TestConvex) {
  return await t.run(async (ctx) => {
    const owner = await seedUser(ctx, OWNER_EMAIL);
    const admin = await seedUser(ctx, ADMIN_EMAIL, { role: "admin" });
    const borrower = await seedUser(ctx, BORROWER_EMAIL);
    const stranger = await seedUser(ctx, OTHER_EMAIL);
    const tool = await seedTool(ctx, owner, { name: "Cordless drill" });
    const requestId = await seedRequest(ctx, {
      toolId: tool,
      ownerId: owner,
      requesterId: borrower,
      startDate: "1999-12-01",
      endDate: "1999-12-31",
      status: "approved",
    });
    const loanId = await seedLoan(ctx, {
      toolId: tool,
      requestId,
      ownerId: owner,
      borrowerId: borrower,
      startDate: "1999-12-01",
      endDate: "1999-12-31",
      dueDate: "1999-12-31",
      status: "overdue",
    });
    return { owner, admin, borrower, stranger, tool, requestId, loanId };
  });
}

type SignedFetchOptions = {
  method?: "GET" | "POST";
  body?: string;
  timestamp?: string;
  secret?: string;
  signature?: string;
  omitTimestamp?: boolean;
  omitSignature?: boolean;
};

/** Call a Convex HTTP route with a correctly signed request. */
async function signedFetch(
  t: TestConvex,
  path: string,
  options: SignedFetchOptions = {},
) {
  const body = options.body ?? "";
  const timestamp = options.timestamp ?? String(Date.now());
  const signature =
    options.signature ??
    (await signAutomationRequest({
      secret: options.secret ?? TEST_SECRET,
      timestamp,
      body,
    }));

  const headers: Record<string, string> = {};
  if (!options.omitTimestamp) headers[TIMESTAMP_HEADER] = timestamp;
  if (!options.omitSignature) headers[SIGNATURE_HEADER] = signature;

  const method = options.method ?? "GET";
  const init: RequestInit = { method, headers };
  if (method !== "GET") {
    headers["content-type"] = "application/json";
    init.body = body;
  }
  return await t.fetch(path, init);
}

function reminderBody(
  loanId: Id<"loans">,
  overrides: Partial<{
    idempotencyKey: string;
    kind: "due_soon" | "overdue";
    status: "sent" | "failed";
    sentAt: number;
    error: string;
  }> = {},
) {
  return JSON.stringify({
    idempotencyKey: overrides.idempotencyKey ?? "reminder-key-1",
    loanId,
    kind: overrides.kind ?? "overdue",
    status: overrides.status ?? "sent",
    sentAt: overrides.sentAt ?? 1_763_000_000_000,
    ...(overrides.error ? { error: overrides.error } : {}),
  });
}

describe("signing helper", () => {
  test("accepts a genuine signature over timestamp.body", async () => {
    const timestamp = String(Date.now());
    const body = JSON.stringify({ event: "request.created" });
    const signature = await signAutomationRequest({
      secret: TEST_SECRET,
      timestamp,
      body,
    });

    await expect(
      verifyAutomationSignature({
        secret: TEST_SECRET,
        timestamp,
        signature,
        body,
      }),
    ).resolves.toEqual({ ok: true });
  });

  test("rejects a tampered body", async () => {
    const timestamp = String(Date.now());
    const body = JSON.stringify({ event: "request.created" });
    const signature = await signAutomationRequest({
      secret: TEST_SECRET,
      timestamp,
      body,
    });

    await expect(
      verifyAutomationSignature({
        secret: TEST_SECRET,
        timestamp,
        signature,
        body: body.replace("created", "cancelled"),
      }),
    ).resolves.toEqual({ ok: false, reason: "signature_mismatch" });
  });

  test("rejects a signature made with a different secret", async () => {
    const timestamp = String(Date.now());
    const body = "{}";
    const signature = await signAutomationRequest({
      secret: "the-wrong-secret",
      timestamp,
      body,
    });

    await expect(
      verifyAutomationSignature({
        secret: TEST_SECRET,
        timestamp,
        signature,
        body,
      }),
    ).resolves.toEqual({ ok: false, reason: "signature_mismatch" });
  });

  test("rejects a stale timestamp", async () => {
    const timestamp = String(Date.now() - 6 * 60_000);
    const body = "{}";
    const signature = await signAutomationRequest({
      secret: TEST_SECRET,
      timestamp,
      body,
    });

    await expect(
      verifyAutomationSignature({
        secret: TEST_SECRET,
        timestamp,
        signature,
        body,
      }),
    ).resolves.toEqual({ ok: false, reason: "timestamp_out_of_window" });
  });

  test("rejects a timestamp too far in the future", async () => {
    const timestamp = String(Date.now() + 6 * 60_000);
    const body = "{}";
    const signature = await signAutomationRequest({
      secret: TEST_SECRET,
      timestamp,
      body,
    });

    await expect(
      verifyAutomationSignature({
        secret: TEST_SECRET,
        timestamp,
        signature,
        body,
      }),
    ).resolves.toEqual({ ok: false, reason: "timestamp_out_of_window" });
  });

  test("accepts a timestamp just inside the window", async () => {
    const timestamp = String(Date.now() - 4 * 60_000);
    const body = "{}";
    const signature = await signAutomationRequest({
      secret: TEST_SECRET,
      timestamp,
      body,
    });

    await expect(
      verifyAutomationSignature({
        secret: TEST_SECRET,
        timestamp,
        signature,
        body,
      }),
    ).resolves.toEqual({ ok: true });
  });

  test("distinguishes missing and malformed headers", async () => {
    await expect(
      verifyAutomationSignature({
        secret: TEST_SECRET,
        timestamp: null,
        signature: "a".repeat(64),
        body: "",
      }),
    ).resolves.toEqual({ ok: false, reason: "missing_timestamp" });

    await expect(
      verifyAutomationSignature({
        secret: TEST_SECRET,
        timestamp: String(Date.now()),
        signature: null,
        body: "",
      }),
    ).resolves.toEqual({ ok: false, reason: "missing_signature" });

    await expect(
      verifyAutomationSignature({
        secret: TEST_SECRET,
        timestamp: "1763000000",
        signature: "a".repeat(64),
        body: "",
      }),
    ).resolves.toEqual({ ok: false, reason: "malformed_timestamp" });

    await expect(
      verifyAutomationSignature({
        secret: TEST_SECRET,
        timestamp: String(Date.now()),
        signature: "not-hex",
        body: "",
      }),
    ).resolves.toEqual({ ok: false, reason: "malformed_signature" });
  });

  test("constantTimeEqual compares without an early exit", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("HTTP endpoints", () => {
  beforeEach(() => {
    process.env.N8N_HMAC_SECRET = TEST_SECRET;
    delete process.env.N8N_REQUEST_WEBHOOK_URL;
  });

  test("an unsigned GET /n8n/overdue returns 401", async () => {
    const t = setup();
    await seedOverdue(t);

    const response = await t.fetch("/n8n/overdue");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "unauthorized",
      reason: "missing_timestamp",
    });
  });

  test("a stale signed GET /n8n/overdue returns 401", async () => {
    const t = setup();
    await seedOverdue(t);

    const response = await signedFetch(t, "/n8n/overdue", {
      timestamp: String(Date.now() - 6 * 60_000),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      reason: "timestamp_out_of_window",
    });
  });

  test("a signed GET /n8n/overdue returns the overdue loans", async () => {
    const t = setup();
    const base = await seedOverdue(t);

    const response = await signedFetch(t, "/n8n/overdue");

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      asOf: string;
      count: number;
      loans: Array<{
        loanId: string;
        borrowerEmail: string;
        daysOverdue: number;
      }>;
    };
    expect(payload.count).toBe(1);
    expect(payload.loans[0].loanId).toBe(base.loanId);
    expect(payload.loans[0].borrowerEmail).toBe(BORROWER_EMAIL);
    expect(payload.loans[0].daysOverdue).toBeGreaterThan(0);
  });

  test("a tampered POST /n8n/reminder-result returns 401 and writes nothing", async () => {
    const t = setup();
    const base = await seedOverdue(t);
    const body = reminderBody(base.loanId);
    const timestamp = String(Date.now());
    const signature = await signAutomationRequest({
      secret: TEST_SECRET,
      timestamp,
      body,
    });

    const response = await t.fetch("/n8n/reminder-result", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [TIMESTAMP_HEADER]: timestamp,
        [SIGNATURE_HEADER]: signature,
      },
      body: body.replace('"sent"', '"failed"'),
    });

    expect(response.status).toBe(401);

    const counts = await t.run(async (ctx) => ({
      reminders: (await ctx.db.query("reminders").collect()).length,
      events: (await ctx.db.query("automationEvents").collect()).length,
      ledger: (await ctx.db.query("automationIdempotency").collect()).length,
    }));
    expect(counts).toEqual({ reminders: 0, events: 0, ledger: 0 });
  });

  test("a valid reminder-result writes one reminder and one audit event", async () => {
    const t = setup();
    const base = await seedOverdue(t);
    const sentAt = 1_763_000_000_000;
    const body = reminderBody(base.loanId, { sentAt });

    const response = await signedFetch(t, "/n8n/reminder-result", {
      method: "POST",
      body,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      duplicate: false,
    });

    const stored = await t.run(async (ctx) => ({
      reminders: await ctx.db.query("reminders").collect(),
      events: await ctx.db
        .query("automationEvents")
        .withIndex("by_loan_created", (q) => q.eq("loanId", base.loanId))
        .collect(),
      ledger: await ctx.db.query("automationIdempotency").collect(),
      loan: await ctx.db.get(base.loanId),
    }));

    expect(stored.reminders).toHaveLength(1);
    expect(stored.reminders[0]).toMatchObject({
      loanId: base.loanId,
      kind: "overdue",
      status: "sent",
      idempotencyKey: "reminder-key-1",
      attempts: 1,
      sentAt,
    });
    expect(stored.events).toHaveLength(1);
    expect(stored.events[0]).toMatchObject({
      direction: "inbound",
      kind: "reminder.sent",
      status: "delivered",
      loanId: base.loanId,
      idempotencyKey: "reminder-key-1",
    });
    expect(stored.ledger).toHaveLength(1);
    expect(stored.loan?.lastReminderAt).toBe(sentAt);
  });

  test("replaying one idempotency key writes exactly one reminder row", async () => {
    const t = setup();
    const base = await seedOverdue(t);
    const body = reminderBody(base.loanId, { sentAt: 1_763_000_000_000 });

    const first = await signedFetch(t, "/n8n/reminder-result", {
      method: "POST",
      body,
    });
    const firstJson = (await first.json()) as {
      ok: boolean;
      duplicate: boolean;
      reminderId: string;
    };

    // A fresh timestamp and signature: the replay must be caught by the
    // idempotency ledger, not by the five-minute window.
    const replay = await signedFetch(t, "/n8n/reminder-result", {
      method: "POST",
      body,
    });
    const replayJson = (await replay.json()) as {
      ok: boolean;
      duplicate: boolean;
      reminderId: string;
    };

    expect(first.status).toBe(200);
    expect(firstJson).toMatchObject({ ok: true, duplicate: false });
    expect(replay.status).toBe(200);
    expect(replayJson).toMatchObject({ ok: true, duplicate: true });
    expect(replayJson.reminderId).toBe(firstJson.reminderId);

    const counts = await t.run(async (ctx) => ({
      reminders: (await ctx.db.query("reminders").collect()).length,
      events: (await ctx.db.query("automationEvents").collect()).length,
      ledger: (await ctx.db.query("automationIdempotency").collect()).length,
      loan: await ctx.db.get(base.loanId),
    }));
    expect(counts).toMatchObject({
      reminders: 1,
      events: 1,
      ledger: 1,
    });
    expect(counts.loan?.lastReminderAt).toBe(1_763_000_000_000);
  });

  test("a new key for the same loan records a second attempt", async () => {
    const t = setup();
    const base = await seedOverdue(t);

    await signedFetch(t, "/n8n/reminder-result", {
      method: "POST",
      body: reminderBody(base.loanId, { idempotencyKey: "key-a" }),
    });
    await signedFetch(t, "/n8n/reminder-result", {
      method: "POST",
      body: reminderBody(base.loanId, { idempotencyKey: "key-b" }),
    });

    const reminders = await t.run(async (ctx) =>
      ctx.db.query("reminders").collect(),
    );
    expect(reminders).toHaveLength(2);
    expect(reminders.map((row) => row.attempts).sort()).toEqual([1, 2]);
  });

  test("a failed reminder is recorded with its error", async () => {
    const t = setup();
    const base = await seedOverdue(t);

    const response = await signedFetch(t, "/n8n/reminder-result", {
      method: "POST",
      body: reminderBody(base.loanId, {
        status: "failed",
        error: "SMTP 550 mailbox unavailable",
      }),
    });

    expect(response.status).toBe(200);

    const stored = await t.run(async (ctx) => ({
      reminder: (await ctx.db.query("reminders").collect())[0],
      event: (await ctx.db.query("automationEvents").collect())[0],
      loan: await ctx.db.get(base.loanId),
    }));
    expect(stored.reminder).toMatchObject({
      status: "failed",
      lastError: "SMTP 550 mailbox unavailable",
    });
    expect(stored.reminder.sentAt).toBeUndefined();
    expect(stored.event).toMatchObject({
      kind: "reminder.failed",
      status: "failed",
      lastError: "SMTP 550 mailbox unavailable",
    });
    expect(stored.loan?.lastReminderAt).toBeUndefined();
  });

  test("a malformed payload returns 400", async () => {
    const t = setup();
    await seedOverdue(t);

    const response = await signedFetch(t, "/n8n/reminder-result", {
      method: "POST",
      body: JSON.stringify({ loanId: "x", kind: "overdue", status: "sent" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_payload",
    });
  });

  test("an unknown loan returns 404 and writes nothing", async () => {
    const t = setup();
    await seedOverdue(t);

    const response = await signedFetch(t, "/n8n/reminder-result", {
      method: "POST",
      body: reminderBody("not-a-loan-id" as Id<"loans">),
    });

    expect(response.status).toBe(404);
    const counts = await t.run(async (ctx) => ({
      reminders: (await ctx.db.query("reminders").collect()).length,
      events: (await ctx.db.query("automationEvents").collect()).length,
      ledger: (await ctx.db.query("automationIdempotency").collect()).length,
    }));
    expect(counts).toEqual({ reminders: 0, events: 0, ledger: 0 });
  });
});

describe("per-loan activity query", () => {
  beforeEach(() => {
    process.env.N8N_HMAC_SECRET = TEST_SECRET;
  });

  test("returns the recorded event with its timestamp and status", async () => {
    const t = setup();
    const base = await seedOverdue(t);

    await signedFetch(t, "/n8n/reminder-result", {
      method: "POST",
      body: reminderBody(base.loanId, { sentAt: 1_763_000_000_000 }),
    });

    const asOwner = await t
      .withIdentity(signIn(OWNER_EMAIL))
      .query(api.automation.loanActivity, { loanId: base.loanId });

    expect(asOwner).toHaveLength(1);
    expect(asOwner[0]).toMatchObject({
      kind: "reminder.sent",
      direction: "inbound",
      workflow: "overdue-reminders",
      status: "delivered",
      lastError: null,
    });
    expect(typeof asOwner[0].createdAt).toBe("number");
    expect(asOwner[0].createdAt).toBeGreaterThan(0);

    const asBorrower = await t
      .withIdentity(signIn(BORROWER_EMAIL))
      .query(api.automation.loanActivity, { loanId: base.loanId });
    expect(asBorrower).toHaveLength(1);

    const asAdmin = await t
      .withIdentity(signIn(ADMIN_EMAIL))
      .query(api.automation.loanActivity, { loanId: base.loanId });
    expect(asAdmin).toHaveLength(1);
  });

  test("is forbidden for a signed-in stranger", async () => {
    const t = setup();
    const base = await seedOverdue(t);

    await expect(
      t
        .withIdentity(signIn(OTHER_EMAIL))
        .query(api.automation.loanActivity, { loanId: base.loanId }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });

  test("requires a signed-in caller", async () => {
    const t = setup();
    const base = await seedOverdue(t);

    await expect(
      t.query(api.automation.loanActivity, { loanId: base.loanId }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });
});

describe("outbound request notification", () => {
  type CapturedRequest = {
    method: string;
    url: string;
    headers: Record<string, string | string[] | undefined>;
    body: string;
  };

  let server: Server;
  let port = 0;
  let captured: CapturedRequest[] = [];
  let respond: (response: import("node:http").ServerResponse) => void;

  beforeAll(async () => {
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        captured.push({
          method: request.method ?? "",
          url: request.url ?? "",
          headers: request.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
        if (respond) {
          respond(response);
          return;
        }
        response.writeHead(200, { "content-type": "application/json" });
        response.end('{"ok":true}');
      });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.N8N_REQUEST_WEBHOOK_URL;
    process.env.N8N_HMAC_SECRET = TEST_SECRET;
  });

  beforeEach(() => {
    captured = [];
    respond = (response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
    };
    process.env.N8N_HMAC_SECRET = TEST_SECRET;
    process.env.N8N_REQUEST_WEBHOOK_URL = `http://127.0.0.1:${port}/n8n/request`;
  });

  test("signs and delivers a request.created event", async () => {
    const t = setup();
    const base = await seedOverdue(t);

    const result = await t.action(internal.automation.notifyRequest, {
      requestId: base.requestId,
    });

    expect(result.delivered).toBe(true);
    expect(result.lastError).toBeNull();
    expect(captured).toHaveLength(1);

    const received = captured[0];
    expect(received.method).toBe("POST");
    const timestamp = received.headers[TIMESTAMP_HEADER] as string;
    const signature = received.headers[SIGNATURE_HEADER] as string;
    await expect(
      verifyAutomationSignature({
        secret: TEST_SECRET,
        timestamp,
        signature,
        body: received.body,
      }),
    ).resolves.toEqual({ ok: true });

    const payload = JSON.parse(received.body) as Record<string, unknown>;
    expect(payload).toMatchObject({
      event: "request.created",
      requestId: base.requestId,
      idempotencyKey: `request-notification:${base.requestId}`,
      tool: { name: "Cordless drill", category: "Power tools" },
      borrower: { email: BORROWER_EMAIL },
      owner: { email: OWNER_EMAIL },
    });
    expect(
      received.headers["x-lendloop-idempotency-key"],
    ).toBe(`request-notification:${base.requestId}`);

    const events = await t.run(async (ctx) =>
      ctx.db
        .query("automationEvents")
        .withIndex("by_direction", (q) => q.eq("direction", "outbound"))
        .collect(),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      status: "delivered",
      kind: "request.created",
      workflow: "request-notification",
    });
  });

  test("records a non-2xx response as failed, not swallowed", async () => {
    respond = (response) => {
      response.writeHead(503, { "content-type": "text/plain" });
      response.end("n8n is restarting");
    };
    const t = setup();
    const base = await seedOverdue(t);

    const result = await t.action(internal.automation.notifyRequest, {
      requestId: base.requestId,
    });

    expect(result.delivered).toBe(false);
    expect(result.lastError).toContain("503");

    const events = await t.run(async (ctx) =>
      ctx.db.query("automationEvents").collect(),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      status: "failed",
      kind: "request.created",
    });
    expect(events[0].lastError).toContain("503");
  });

  test("records a missing webhook URL as failed, not swallowed", async () => {
    delete process.env.N8N_REQUEST_WEBHOOK_URL;
    const t = setup();
    const base = await seedOverdue(t);

    const result = await t.action(internal.automation.notifyRequest, {
      requestId: base.requestId,
    });

    expect(result.delivered).toBe(false);
    expect(result.lastError).toContain("N8N_REQUEST_WEBHOOK_URL");

    const events = await t.run(async (ctx) =>
      ctx.db.query("automationEvents").collect(),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ status: "failed" });
    expect(events[0].lastError).toContain("N8N_REQUEST_WEBHOOK_URL");
  });

  test("creating a request schedules the signed notification", async () => {
    const t = setup();
    const base = await t.run(async (ctx) => {
      const owner = await seedUser(ctx, OWNER_EMAIL);
      const borrower = await seedUser(ctx, BORROWER_EMAIL);
      const tool = await seedTool(ctx, owner);
      return { owner, borrower, tool };
    });

    await t.withIdentity(signIn(BORROWER_EMAIL)).mutation(api.requests.create, {
      toolId: base.tool,
      startDate: isoDay(3),
      endDate: isoDay(5),
    });

    await t.finishAllScheduledFunctions(() => {});

    expect(captured).toHaveLength(1);
    const payload = JSON.parse(captured[0].body) as {
      requestId: string;
      event: string;
    };
    expect(payload.event).toBe("request.created");

    const events = await t.run(async (ctx) =>
      ctx.db.query("automationEvents").collect(),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      status: "delivered",
      direction: "outbound",
      idempotencyKey: `request-notification:${payload.requestId}`,
    });
  });
});
