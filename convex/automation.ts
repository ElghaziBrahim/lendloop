import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, query } from "./_generated/server";
import { requireAdmin, requireUser } from "./lib/authz";
import { signAutomationRequest } from "./lib/signing";
import {
  automationDirectionValidator,
  automationStatusValidator,
} from "./schema";

/**
 * The automation boundary between Convex and n8n.
 *
 * ## Outbound: Convex -> n8n
 *
 * `POST $N8N_REQUEST_WEBHOOK_URL`
 *
 * Headers:
 *   content-type: application/json
 *   x-lendloop-timestamp: <epoch milliseconds, decimal>
 *   x-lendloop-signature: <lowercase hex HMAC-SHA256 of `${timestamp}.${body}`>
 *   x-lendloop-idempotency-key: request-notification:<requestId>
 *
 * Body:
 *   {
 *     "event": "request.created",
 *     "requestId": "...",
 *     "idempotencyKey": "request-notification:...",
 *     "tool": { "name": "...", "category": "..." },
 *     "borrower": { "name": "...", "email": "..." },
 *     "owner": { "name": "...", "email": "..." },
 *     "startDate": "YYYY-MM-DD",
 *     "endDate": "YYYY-MM-DD",
 *     "message": "..." | null,
 *     "createdAt": 1763000000000
 *   }
 *
 * Any 2xx is success. A non-2xx response, a network error or a missing
 * configuration is written to `automationEvents` with `status: "failed"` and the
 * reason in `lastError`: outbound failures are never swallowed.
 *
 * ## Inbound: n8n -> Convex
 *
 * `GET /n8n/overdue` and `POST /n8n/reminder-result`, verified in
 * `convex/http.ts`. `scripts/mock-n8n-receiver.mjs` implements the same check
 * for the outbound direction and can drive a full scripted round trip.
 *
 * The write-side internals live in `convex/automationStore.ts`, so this module's
 * action can call them without a circular type reference.
 */

const outboundResultValidator = v.object({
  eventId: v.id("automationEvents"),
  delivered: v.boolean(),
  lastError: v.union(v.string(), v.null()),
});

/** Mirrors `requestEventValidator` in convex/automationStore.ts. */
type RequestEvent = {
  requestId: Id<"requests">;
  toolName: string;
  toolCategory: string;
  ownerName: string | null;
  ownerEmail: string;
  borrowerName: string | null;
  borrowerEmail: string;
  startDate: string;
  endDate: string;
  message: string | null;
  createdAt: number;
};

type OutboundResult = {
  eventId: Id<"automationEvents">;
  delivered: boolean;
  lastError: string | null;
};

function signingSecret(): string | null {
  const secret = process.env.N8N_HMAC_SECRET;
  return typeof secret === "string" && secret.length > 0 ? secret : null;
}

function webhookUrl(): string | null {
  const url = process.env.N8N_REQUEST_WEBHOOK_URL;
  return typeof url === "string" && url.length > 0 ? url : null;
}

/**
 * Sign and deliver a `request.created` event to n8n.
 *
 * Scheduled by `requests.create`, so a slow or broken n8n never blocks or fails
 * the borrower's request. Every outcome is written to `automationEvents`.
 */
export const notifyRequest = internalAction({
  args: { requestId: v.id("requests") },
  returns: outboundResultValidator,
  handler: async (ctx, args): Promise<OutboundResult> => {
    const requestEvent: RequestEvent | null = await ctx.runQuery(
      internal.automationStore.loadRequestEvent,
      { requestId: args.requestId },
    );
    if (!requestEvent) {
      throw new ConvexError({
        code: "REQUEST_NOT_FOUND",
        message: "The request to notify n8n about no longer exists.",
      });
    }

    const idempotencyKey = `request-notification:${args.requestId}`;
    const body: string = JSON.stringify({
      event: "request.created",
      requestId: requestEvent.requestId,
      idempotencyKey,
      tool: {
        name: requestEvent.toolName,
        category: requestEvent.toolCategory,
      },
      borrower: {
        name: requestEvent.borrowerName,
        email: requestEvent.borrowerEmail,
      },
      owner: {
        name: requestEvent.ownerName,
        email: requestEvent.ownerEmail,
      },
      startDate: requestEvent.startDate,
      endDate: requestEvent.endDate,
      message: requestEvent.message,
      createdAt: requestEvent.createdAt,
    });

    const eventId: Id<"automationEvents"> = await ctx.runMutation(
      internal.automationStore.recordOutboundStart,
      {
        kind: "request.created",
        workflow: "request-notification",
        idempotencyKey,
        payload: body,
      },
    );

    let lastError: string | null = null;
    const url = webhookUrl();
    const secret = signingSecret();

    if (!url) {
      lastError = "N8N_REQUEST_WEBHOOK_URL is not configured.";
    } else if (!secret) {
      lastError = "N8N_HMAC_SECRET is not configured.";
    } else {
      try {
        const timestamp = String(Date.now());
        const signature = await signAutomationRequest({
          secret,
          timestamp,
          body,
        });
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-lendloop-timestamp": timestamp,
            "x-lendloop-signature": signature,
            "x-lendloop-idempotency-key": idempotencyKey,
          },
          body,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          lastError = `n8n responded ${response.status}${
            detail ? `: ${detail.slice(0, 300)}` : ""
          }`;
        }
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : String(error ?? "unknown");
        lastError = lastError.slice(0, 500);
      }
    }

    await ctx.runMutation(internal.automationStore.recordOutboundResult, {
      eventId,
      lastError,
    });

    return { eventId, delivered: lastError === null, lastError };
  },
});

/**
 * The board-wide automation feed: the most recent events from both directions,
 * newest first. Admin only — it names workflows and failures for every loan,
 * which is the admin surface's job, not a member's.
 *
 * This is the read side of the audit trail the outbound notification and the
 * n8n write-back write to, and the place to look when a workflow goes quiet.
 */
export const recentActivity = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("automationEvents"),
      kind: v.string(),
      direction: automationDirectionValidator,
      workflow: v.union(v.string(), v.null()),
      status: automationStatusValidator,
      lastError: v.union(v.string(), v.null()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 12), 1), 50);
    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_created")
      .order("desc")
      .take(limit);

    return events.map((event) => ({
      _id: event._id,
      kind: event.kind,
      direction: event.direction,
      workflow: event.workflow ?? null,
      status: event.status,
      lastError: event.lastError ?? null,
      createdAt: event.createdAt,
    }));
  },
});

/**
 * The per-loan automation feed: every inbound reminder outcome for one loan,

 * newest first, with its timestamp and status.
 *
 * Visible to the borrower, the lender and admins. Everyone else gets FORBIDDEN,
 * so the feed never becomes a side channel for another user's loan.
 */
export const loanActivity = query({
  args: { loanId: v.id("loans") },
  returns: v.array(
    v.object({
      _id: v.id("automationEvents"),
      kind: v.string(),
      direction: automationDirectionValidator,
      workflow: v.union(v.string(), v.null()),
      status: automationStatusValidator,
      lastError: v.union(v.string(), v.null()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new ConvexError({
        code: "LOAN_NOT_FOUND",
        message: "That loan no longer exists.",
      });
    }
    if (
      user.role !== "admin" &&
      user._id !== loan.ownerId &&
      user._id !== loan.borrowerId
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You can only view activity for your own loans.",
      });
    }

    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_loan_created", (q) => q.eq("loanId", args.loanId))
      .order("desc")
      .collect();

    return events.map((event) => ({
      _id: event._id,
      kind: event.kind,
      direction: event.direction,
      workflow: event.workflow ?? null,
      status: event.status,
      lastError: event.lastError ?? null,
      createdAt: event.createdAt,
    }));
  },
});
