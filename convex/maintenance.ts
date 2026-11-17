import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Retention for the automation bookkeeping, run daily by the cron in
 * `convex/crons.ts`.
 *
 * The two automation tables grow without bound otherwise: every outbound
 * trigger and every inbound write-back adds an `automationEvents` row, and
 * every accepted write-back also leaves an `automationIdempotency` row.
 *
 * Each phase is bounded. A table larger than the batch is shrunk over
 * successive daily runs rather than in one long mutation.
 */

const RETRY_HORIZON_MS = 7 * 86_400_000; // n8n retries for hours, not weeks
const STALE_PENDING_MS = 60 * 60_000; // an outbound action should finish in seconds
const AUDIT_RETENTION_MS = 90 * 86_400_000;
const BATCH = 200;

export const pruneAutomation = internalMutation({
  args: {},
  returns: v.object({
    prunedIdempotency: v.number(),
    markedStale: v.number(),
    prunedEvents: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    // Replay keys older than the retry horizon can no longer be replayed.
    const staleKeys = await ctx.db
      .query("automationIdempotency")
      .withIndex("by_created", (q) =>
        q.lt("createdAt", now - RETRY_HORIZON_MS),
      )
      .take(BATCH);
    for (const row of staleKeys) {
      await ctx.db.delete(row._id);
    }

    // An outbound row still pending after an hour belongs to an action that
    // died mid-flight. Close it so it stops looking like live work.
    const stalePending = await ctx.db
      .query("automationEvents")
      .withIndex("by_status_created", (q) =>
        q.eq("status", "pending").lt("createdAt", now - STALE_PENDING_MS),
      )
      .take(BATCH);
    for (const row of stalePending) {
      await ctx.db.patch(row._id, {
        status: "failed",
        lastError: "No result was recorded within an hour.",
      });
    }

    // The audit trail keeps a season of events, not every event ever written.
    const oldEvents = await ctx.db
      .query("automationEvents")
      .withIndex("by_created", (q) =>
        q.lt("createdAt", now - AUDIT_RETENTION_MS),
      )
      .take(BATCH);
    for (const row of oldEvents) {
      await ctx.db.delete(row._id);
    }

    return {
      prunedIdempotency: staleKeys.length,
      markedStale: stalePending.length,
      prunedEvents: oldEvents.length,
    };
  },
});
