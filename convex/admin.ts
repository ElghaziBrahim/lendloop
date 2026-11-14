import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/authz";
import { isPastDue, todayIso } from "./lib/dates";
import { loanStatusValidator } from "./schema";

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
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();

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

/**
 * Every listing in the system, removed ones included, so an admin can see the
 * shelf as it really is and remove any of it. Same projection the owner sees
 * plus the owner's email and the lifecycle status.
 */
export const listTools = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const tools = await ctx.db.query("tools").collect();
    const views = await Promise.all(
      tools
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (tool) => {
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

async function loanView(
  ctx: QueryCtx,
  loan: Doc<"loans">,
  today: string,
) {
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
    overdue: loan.status !== "returned" && isPastDue(loan.dueDate, today),
    returnedAt: loan.returnedAt ?? null,
  };
}

/** Every loan in the system, optionally filtered by stored status. */
export const listLoans = query({
  args: { status: v.optional(loanStatusValidator) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const status = args.status;
    const loans = status
      ? await ctx.db
          .query("loans")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect()
      : await ctx.db.query("loans").collect();

    const today = todayIso();
    return await Promise.all(
      loans
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((loan) => loanView(ctx, loan, today)),
    );
  },
});
