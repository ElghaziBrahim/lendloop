import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authz";
import {
  loanStatusValidator,
  roleValidator,
  toolStatusValidator,
} from "./schema";

/**
 * Admin surface.
 *
 * These are the only functions that read or change data the caller does not
 * own. Every one of them calls `requireAdmin` first, and each is a separate
 * entry point so a client cannot reach admin behaviour by widening a normal
 * mutation.
 */

/** Everyone with an account, for the trusted-lender list. No Clerk ids. */
export const listUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.union(v.string(), v.null()),
      role: roleValidator,
      trustedLender: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Bounded: the newest 500 accounts, presented alphabetically. A larger
    // circle needs pagination before this cap is reached.
    const users = await ctx.db.query("users").order("desc").take(500);

    return users
      .sort((a, b) => a.email.localeCompare(b.email))
      .map((user) => ({
        _id: user._id,
        email: user.email,
        name: user.name ?? null,
        role: user.role,
        trustedLender: user.trustedLender,
        createdAt: user.createdAt,
      }));
  },
});

/** Mark a lender trusted (or take the mark away). */
export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError({
        code: "USER_NOT_FOUND",
        message: "That user does not exist.",
      });
    }

    await ctx.db.patch(user._id, { trustedLender: args.trusted });
    return user._id;
  },
});

/** The admin listing view: the owner's projection plus who owns it. */
const adminToolViewValidator = v.object({
  _id: v.id("tools"),
  name: v.string(),
  category: v.string(),
  description: v.union(v.string(), v.null()),
  status: toolStatusValidator,
  ownerName: v.union(v.string(), v.null()),
  ownerEmail: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/**
 * Every listing in the system, removed ones included, so an admin can see the
 * shelf as it really is and remove any of it. Same projection the owner sees
 * plus the owner's email and the lifecycle status.
 */
export const listTools = query({
  args: {},
  returns: v.array(adminToolViewValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const tools = await ctx.db.query("tools").order("desc").take(500);
    const views = await Promise.all(
      tools.map(async (tool) => {
        const owner = await ctx.db.get(tool.ownerId);
        return {
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          description: tool.description ?? null,
          status: tool.status,
          ownerName: owner?.name ?? null,
          ownerEmail: owner?.email ?? "",
          createdAt: tool.createdAt,
          updatedAt: tool.updatedAt,
        };
      }),
    );
    return views;
  },
});

/**
 * Remove any listing. Same soft delete as `tools.remove`, reachable without
 * being the owner; the row stays so existing loans still resolve.
 */
export const removeTool = mutation({
  args: { toolId: v.id("tools") },
  returns: v.id("tools"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const tool = await ctx.db.get(args.toolId);
    if (!tool) {
      throw new ConvexError({
        code: "TOOL_NOT_FOUND",
        message: "That listing no longer exists.",
      });
    }

    if (tool.status === "active") {
      await ctx.db.patch(tool._id, {
        status: "removed",
        updatedAt: Date.now(),
      });
    }

    return tool._id;
  },
});

const adminLoanViewValidator = v.object({
  _id: v.id("loans"),
  requestId: v.id("requests"),
  toolId: v.id("tools"),
  toolName: v.string(),
  borrowerName: v.union(v.string(), v.null()),
  borrowerEmail: v.string(),
  ownerName: v.union(v.string(), v.null()),
  ownerEmail: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  dueDate: v.string(),
  status: loanStatusValidator,
  overdue: v.boolean(),
  returnedAt: v.union(v.number(), v.null()),
});

async function loanView(ctx: QueryCtx, loan: Doc<"loans">) {
  const tool = await ctx.db.get(loan.toolId);
  const borrower = await ctx.db.get(loan.borrowerId);
  const owner = await ctx.db.get(loan.ownerId);

  return {
    _id: loan._id,
    requestId: loan.requestId,
    toolId: loan.toolId,
    toolName: tool?.name ?? "Removed tool",
    borrowerName: borrower?.name ?? null,
    borrowerEmail: borrower?.email ?? "",
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? "",
    startDate: loan.startDate,
    endDate: loan.endDate,
    dueDate: loan.dueDate,
    status: loan.status,
    // Stored state, kept current by the daily `loans.markOverdue` cron.
    overdue: loan.status === "overdue",
    returnedAt: loan.returnedAt ?? null,
  };
}

/** Every loan in the system, optionally filtered by stored status. */
export const listLoans = query({
  args: { status: v.optional(loanStatusValidator) },
  returns: v.array(adminLoanViewValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const status = args.status;
    const loans = status
      ? await ctx.db
          .query("loans")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .take(500)
      : await ctx.db.query("loans").order("desc").take(500);

    return await Promise.all(loans.map((loan) => loanView(ctx, loan)));
  },
});
