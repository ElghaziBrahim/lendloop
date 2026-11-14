import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { reminderKindValidator } from "./schema";

/**
 * Database side of the automation boundary.
 *
 * Kept apart from `convex/automation.ts` so the action there can call these
 * functions through `internal.automationStore.*` without the module referring to
 * its own inferred type (which TypeScript rejects as circular).
 */

/** Everything n8n needs to render a request notification, and nothing else. */
const requestEventValidator = v.object({
  requestId: v.id("requests"),
  toolName: v.string(),
  toolCategory: v.string(),
  ownerName: v.union(v.string(), v.null()),
  ownerEmail: v.string(),
  borrowerName: v.union(v.string(), v.null()),
  borrowerEmail: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  message: v.union(v.string(), v.null()),
  createdAt: v.number(),
});

/** Load the request as an event. The action never trusts client-supplied data. */
export const loadRequestEvent = internalQuery({
  args: { requestId: v.id("requests") },
  returns: v.union(requestEventValidator, v.null()),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) return null;

    const tool = await ctx.db.get(request.toolId);
    const owner = await ctx.db.get(request.ownerId);
    const borrower = await ctx.db.get(request.requesterId);

    return {
      requestId: request._id,
      toolName: tool?.name ?? "Removed tool",
      toolCategory: tool?.category ?? "Removed",
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? "",
      borrowerName: borrower?.name ?? null,
      borrowerEmail: borrower?.email ?? "",
      startDate: request.startDate,
      endDate: request.endDate,
      message: request.message ?? null,
      createdAt: request.createdAt,
    };
  },
});

/** Record the attempt before the network call, so a crash still leaves a trace. */
export const recordOutboundStart = internalMutation({
  args: {
    kind: v.string(),
    workflow: v.string(),
    idempotencyKey: v.string(),
    payload: v.string(),
  },
  returns: v.id("automationEvents"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("automationEvents", {
      kind: args.kind,
      direction: "outbound",
      workflow: args.workflow,
      idempotencyKey: args.idempotencyKey,
      payload: args.payload,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

/** Close the attempt with its outcome. `lastError: null` means delivered. */
export const recordOutboundResult = internalMutation({
  args: {
    eventId: v.id("automationEvents"),
    lastError: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new ConvexError({
        code: "EVENT_NOT_FOUND",
        message: "The outbound automation event was deleted mid-flight.",
      });
    }
    await ctx.db.patch(args.eventId, {
      status: args.lastError === null ? "delivered" : "failed",
      lastError: args.lastError ?? undefined,
    });
    return null;
  },
});

type StoredReminderResult = {
  reminderId: string | null;
  eventId: string | null;
};

function parseStoredResult(raw: string): StoredReminderResult {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredReminderResult>;
    return {
      reminderId:
        typeof parsed.reminderId === "string" ? parsed.reminderId : null,
      eventId: typeof parsed.eventId === "string" ? parsed.eventId : null,
    };
  } catch {
    return { reminderId: null, eventId: null };
  }
}

const reminderWriteResultValidator = v.object({
  duplicate: v.boolean(),
  reminderId: v.union(v.id("reminders"), v.null()),
  eventId: v.union(v.id("automationEvents"), v.null()),
  /** Null on success; a machine code when the write was rejected. */
  code: v.union(v.string(), v.null()),
});

const MAX_IDEMPOTENCY_KEY = 200;
const MAX_ERROR_LENGTH = 500;

/**
 * The n8n write-back: record the outcome of one reminder.
 *
 * A replay with the same idempotency key returns the first call's ids and
 * performs no write at all: no second reminder row, no second audit event, and
 * no change to the loan. The ledger and the write happen in one mutation, so
 * the ledger can never claim success for a reminder that was not stored.
 */
export const recordReminderResult = internalMutation({
  args: {
    idempotencyKey: v.string(),
    loanId: v.string(),
    kind: reminderKindValidator,
    status: v.union(v.literal("sent"), v.literal("failed")),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  returns: reminderWriteResultValidator,
  handler: async (ctx, args) => {
    const key = args.idempotencyKey.trim();
    if (key.length === 0 || key.length > MAX_IDEMPOTENCY_KEY) {
      return {
        duplicate: false,
        reminderId: null,
        eventId: null,
        code: "INVALID_IDEMPOTENCY_KEY",
      };
    }

    const ledger = await ctx.db
      .query("automationIdempotency")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (ledger) {
      const stored = parseStoredResult(ledger.result);
      return {
        duplicate: true,
        reminderId: stored.reminderId as Id<"reminders"> | null,
        eventId: stored.eventId as Id<"automationEvents"> | null,
        code: null,
      };
    }

    // Second guard, for a reminder written before the ledger existed. It also
    // makes the key unique even if two callers raced past the ledger read.
    const alreadyWritten = await ctx.db
      .query("reminders")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", key))
      .first();
    if (alreadyWritten) {
      return {
        duplicate: true,
        reminderId: alreadyWritten._id,
        eventId: null,
        code: null,
      };
    }

    const loanId = ctx.db.normalizeId("loans", args.loanId);
    const loan = loanId ? await ctx.db.get(loanId) : null;
    if (!loanId || !loan) {
      return {
        duplicate: false,
        reminderId: null,
        eventId: null,
        code: "LOAN_NOT_FOUND",
      };
    }

    const now = Date.now();
    const sentAt = args.status === "sent" ? (args.sentAt ?? now) : undefined;
    const lastError =
      args.status === "failed"
        ? (args.error?.trim() || "n8n reported the reminder as failed.").slice(
            0,
            MAX_ERROR_LENGTH,
          )
        : undefined;

    const prior = await ctx.db
      .query("reminders")
      .withIndex("by_loan", (q) => q.eq("loanId", loanId))
      .collect();
    const attempts = prior.filter((row) => row.kind === args.kind).length + 1;

    const reminderId = await ctx.db.insert("reminders", {
      loanId,
      kind: args.kind,
      status: args.status,
      idempotencyKey: key,
      attempts,
      sentAt,
      lastError,
      createdAt: now,
    });

    const eventId = await ctx.db.insert("automationEvents", {
      kind: args.status === "sent" ? "reminder.sent" : "reminder.failed",
      direction: "inbound",
      workflow: "overdue-reminders",
      idempotencyKey: key,
      loanId,
      payload: JSON.stringify({
        loanId,
        kind: args.kind,
        status: args.status,
        sentAt: sentAt ?? null,
        error: lastError ?? null,
      }),
      status: args.status === "sent" ? "delivered" : "failed",
      lastError,
      createdAt: now,
    });

    if (args.status === "sent") {
      await ctx.db.patch(loanId, { lastReminderAt: sentAt ?? now });
    }

    await ctx.db.insert("automationIdempotency", {
      key,
      kind: "reminder-result",
      result: JSON.stringify({ reminderId, eventId }),
      createdAt: now,
    });

    return { duplicate: false, reminderId, eventId, code: null };
  },
});
