import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { findApprovedConflicts } from "./lib/availability";
import { requireOwnerOrAdmin, requireUser } from "./lib/authz";
import {
  assertBookableRange,
  rangesOverlap,
  todayIso,
} from "./lib/dates";
import { MESSAGE_MAX, optionalText } from "./lib/validation";
import { requestStatusValidator } from "./schema";

/**
 * Requests: a borrower asks for a tool over a day range, the tool's owner
 * approves or declines, and an approval becomes a loan.
 *
 * `ownerId` is stored on the request when it is created, so the decision
 * mutation can authorize from the request alone and cannot be tricked into
 * approving on behalf of a different owner.
 */

/** The shape every request read returns. `message` and `decidedAt` are nullable. */
const requestViewValidator = v.object({
  _id: v.id("requests"),
  toolId: v.id("tools"),
  toolName: v.string(),
  toolCategory: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  message: v.union(v.string(), v.null()),
  status: requestStatusValidator,
  createdAt: v.number(),
  decidedAt: v.union(v.number(), v.null()),
});

/** The owner's inbox adds the requester's identity. */
const incomingRequestViewValidator = requestViewValidator.extend({
  requesterName: v.union(v.string(), v.null()),
  requesterEmail: v.string(),
});

async function toolName(ctx: QueryCtx | MutationCtx, toolId: Id<"tools">) {
  const tool = await ctx.db.get(toolId);
  return tool
    ? { toolName: tool.name, toolCategory: tool.category }
    : { toolName: "Removed tool", toolCategory: "Removed" };
}

/** Load a request and require the caller to be its owner (or an admin). */
async function loadForDecision(
  ctx: MutationCtx,
  requestId: Id<"requests">,
): Promise<{ request: Doc<"requests">; user: Doc<"users"> }> {
  const request = await ctx.db.get(requestId);
  if (!request) {
    throw new ConvexError({
      code: "REQUEST_NOT_FOUND",
      message: "That request no longer exists.",
    });
  }
  const user = await requireOwnerOrAdmin(ctx, request.ownerId);
  return { request, user };
}

/** A request may only be decided while it is still pending. */
function assertPending(request: Doc<"requests">): void {
  if (request.status !== "pending") {
    throw new ConvexError({
      code: "ALREADY_DECIDED",
      message: `This request was already ${request.status}.`,
    });
  }
}

/**
 * Ask to borrow a tool. Refuses a range that overlaps an approved request, a
 * second live request from the same borrower for the same tool, and asking for
 * one's own listing.
 */
export const create = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
    message: v.optional(v.string()),
  },
  returns: v.id("requests"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.status !== "active") {
      throw new ConvexError({
        code: "TOOL_NOT_AVAILABLE",
        message: "That tool is not available to borrow.",
      });
    }
    if (tool.ownerId === user._id) {
      throw new ConvexError({
        code: "OWN_TOOL",
        message: "You cannot request your own tool.",
      });
    }

    assertBookableRange(args.startDate, args.endDate, todayIso());

    const conflicts = await findApprovedConflicts(
      ctx,
      tool._id,
      args.startDate,
      args.endDate,
    );
    if (conflicts.length > 0) {
      throw new ConvexError({
        code: "TOOL_UNAVAILABLE",
        message: "That tool is already booked for part of those dates.",
      });
    }

    // One pending ask per borrower per tool: a double submit or an impatient
    // retry must not fill the owner's inbox with duplicates. An approved
    // request needs no check here: the availability check above already blocks
    // it while its loan is out and frees the dates once the loan is returned.
    // Newest first: a pending duplicate is a recent request, so the cap keeps
    // the rows this guard needs.
    const ownRequests = await ctx.db
      .query("requests")
      .withIndex("by_requester", (q) => q.eq("requesterId", user._id))
      .order("desc")
      .take(200);
    const duplicate = ownRequests.find(
      (request) =>
        request.toolId === tool._id &&
        request.status === "pending" &&
        rangesOverlap(
          args.startDate,
          args.endDate,
          request.startDate,
          request.endDate,
        ),
    );
    if (duplicate) {
      throw new ConvexError({
        code: "ALREADY_REQUESTED",
        message: "You already have a request for that tool on those dates.",
      });
    }

    const requestId = await ctx.db.insert("requests", {
      toolId: tool._id,
      requesterId: user._id,
      ownerId: tool.ownerId,
      startDate: args.startDate,
      endDate: args.endDate,
      message: optionalText(args.message, "Message", MESSAGE_MAX),
      status: "pending",
      createdAt: Date.now(),
    });

    // Notify n8n after the request commits. Scheduled rather than awaited: a
    // slow or broken automation must not fail or delay the borrower's request.
    // The action records its own outcome in `automationEvents`.
    await ctx.scheduler.runAfter(
      0,
      internal.automation.notifyRequest,
      { requestId },
    );

    return requestId;
  },
});

/** Requests the caller made, newest first. Never another borrower's. */
export const listMine = query({
  args: {},
  returns: v.array(requestViewValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const requests = await ctx.db
      .query("requests")
      .withIndex("by_requester", (q) => q.eq("requesterId", user._id))
      .order("desc")
      .take(200);

    const views = await Promise.all(
      requests.map(async (request) => ({
        _id: request._id,
        toolId: request.toolId,
        ...(await toolName(ctx, request.toolId)),
        startDate: request.startDate,
        endDate: request.endDate,
        message: request.message ?? null,
        status: request.status,
        createdAt: request.createdAt,
        decidedAt: request.decidedAt ?? null,
      })),
    );
    return views;
  },
});

/**
 * Requests for the caller's own tools, newest first. This is the only place a
 * requester's name and email are returned, and only to the owner who has to
 * decide.
 */
export const listIncoming = query({
  args: {},
  returns: v.array(incomingRequestViewValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const requests = await ctx.db
      .query("requests")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(200);

    const views = await Promise.all(
      requests.map(async (request) => {
        const requester = await ctx.db.get(request.requesterId);
        return {
          _id: request._id,
          toolId: request.toolId,
          ...(await toolName(ctx, request.toolId)),
          requesterName: requester?.name ?? null,
          requesterEmail: requester?.email ?? "",
          startDate: request.startDate,
          endDate: request.endDate,
          message: request.message ?? null,
          status: request.status,
          createdAt: request.createdAt,
          decidedAt: request.decidedAt ?? null,
        };
      }),
    );
    return views;
  },
});

/**
 * Approve a pending request. Owner or admin. Availability is re-checked here,
 * not trusted from creation time: two overlapping requests may both have been
 * pending, and only the first approval may win.
 */
export const approve = mutation({
  args: { requestId: v.id("requests") },
  returns: v.id("requests"),
  handler: async (ctx, args) => {
    const { request, user } = await loadForDecision(ctx, args.requestId);
    assertPending(request);

    const conflicts = await findApprovedConflicts(
      ctx,
      request.toolId,
      request.startDate,
      request.endDate,
      request._id,
    );
    if (conflicts.length > 0) {
      throw new ConvexError({
        code: "TOOL_UNAVAILABLE",
        message: "Another approved request already covers those dates.",
      });
    }

    const now = Date.now();

    await ctx.db.insert("loans", {
      toolId: request.toolId,
      requestId: request._id,
      borrowerId: request.requesterId,
      ownerId: request.ownerId,
      startDate: request.startDate,
      endDate: request.endDate,
      dueDate: request.endDate,
      status: "active",
      createdAt: now,
    });

    await ctx.db.patch(request._id, {
      status: "approved",
      decidedAt: now,
      decidedBy: user._id,
    });

    return request._id;
  },
});

/** Decline a pending request. Owner or admin; creates no loan. */
export const decline = mutation({
  args: { requestId: v.id("requests") },
  returns: v.id("requests"),
  handler: async (ctx, args) => {
    const { request, user } = await loadForDecision(ctx, args.requestId);
    assertPending(request);

    await ctx.db.patch(request._id, {
      status: "declined",
      decidedAt: Date.now(),
      decidedBy: user._id,
    });

    return request._id;
  },
});

/**
 * Cancel a pending request. The requester owns it; an admin may also cancel.
 * Once approved, the loan must be returned instead, which only the lender or
 * an admin can confirm.
 */
export const cancel = mutation({
  args: { requestId: v.id("requests") },
  returns: v.id("requests"),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError({
        code: "REQUEST_NOT_FOUND",
        message: "That request no longer exists.",
      });
    }
    const user = await requireOwnerOrAdmin(ctx, request.requesterId);
    assertPending(request);

    await ctx.db.patch(request._id, {
      status: "cancelled",
      decidedAt: Date.now(),
      decidedBy: user._id,
    });

    return request._id;
  },
});
