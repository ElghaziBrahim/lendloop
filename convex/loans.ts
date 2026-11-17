import { ConvexError, v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAdmin, requireOwnerOrAdmin, requireUser } from "./lib/authz";
import { daysBetween, isIsoDate, todayIso } from "./lib/dates";
import { loanStatusValidator } from "./schema";

/**
 * Loans.
 *
 * A loan is created by approving a request (`requests.approve`), never by the
 * client. `dueDate` is the last day of the approved range, so a loan is
 * overdue the day *after* it: `dueDate < today`, not `<=`.
 *
 * `status` is the stored source of truth for the overdue flag. The daily cron
 * (`loans.markOverdue`) flips a past-due `active` loan to `overdue`, and the
 * list queries read the stored value instead of the wall clock. The reminder
 * feed (`overdue` / `overdueForAutomation`) still computes from `dueDate`, so a
 * loan is reported the moment it is late even if the sweep has not run yet.
 */

/** The borrower's loan view. */
const loanViewValidator = v.object({
  _id: v.id("loans"),
  toolId: v.id("tools"),
  toolName: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  dueDate: v.string(),
  status: loanStatusValidator,
  overdue: v.boolean(),
  returnedAt: v.union(v.number(), v.null()),
});

/** The lender's loan view adds who holds the item. */
const incomingLoanViewValidator = loanViewValidator.extend({
  borrowerName: v.union(v.string(), v.null()),
  borrowerEmail: v.string(),
});

/** The lender confirms the item is back; borrower and admin cannot fake it. */
export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  returns: v.id("loans"),
  handler: async (ctx, args) => {
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new ConvexError({
        code: "LOAN_NOT_FOUND",
        message: "That loan no longer exists.",
      });
    }

    const user = await requireOwnerOrAdmin(ctx, loan.ownerId);

    // Idempotent: a double-click, or a retry after a dropped response, must
    // not overwrite the original return time.
    if (loan.status === "returned") return loan._id;

    await ctx.db.patch(loan._id, {
      status: "returned",
      returnedAt: Date.now(),
      returnedBy: user._id,
    });

    return loan._id;
  },
});

/**
 * Materialise overdue state, run daily by the cron in `convex/crons.ts`.
 *
 * Only `active` rows are considered: they are the ones that have not been
 * flipped yet, and a returned row is never touched. The read is bounded, and
 * the next run picks up anything beyond the first thousand rows.
 */
export const markOverdue = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const due = await ctx.db
      .query("loans")
      .withIndex("by_status_due", (q) =>
        q.eq("status", "active").lt("dueDate", todayIso()),
      )
      .take(1000);

    for (const loan of due) {
      await ctx.db.patch(loan._id, { status: "overdue" });
    }

    return due.length;
  },
});

/** Loans the caller borrowed, newest first. */
export const listMine = query({
  args: {},
  returns: v.array(loanViewValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .order("desc")
      .take(200);

    const views = await Promise.all(
      loans.map(async (loan) => {
        const tool = await ctx.db.get(loan.toolId);
        return {
          _id: loan._id,
          toolId: loan.toolId,
          toolName: tool?.name ?? "Removed tool",
          startDate: loan.startDate,
          endDate: loan.endDate,
          dueDate: loan.dueDate,
          status: loan.status,
          overdue: loan.status === "overdue",
          returnedAt: loan.returnedAt ?? null,
        };
      }),
    );
    return views;
  },
});

/** Loans of the caller's tools, newest first, with who has the item. */
export const listIncoming = query({
  args: {},
  returns: v.array(incomingLoanViewValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(200);

    const views = await Promise.all(
      loans.map(async (loan) => {
        const tool = await ctx.db.get(loan.toolId);
        const borrower = await ctx.db.get(loan.borrowerId);
        return {
          _id: loan._id,
          toolId: loan.toolId,
          toolName: tool?.name ?? "Removed tool",
          borrowerName: borrower?.name ?? null,
          borrowerEmail: borrower?.email ?? "",
          startDate: loan.startDate,
          endDate: loan.endDate,
          dueDate: loan.dueDate,
          status: loan.status,
          overdue: loan.status === "overdue",
          returnedAt: loan.returnedAt ?? null,
        };
      }),
    );
    return views;
  },
});

/**
 * Every past-due, unreturned loan. Admin only, and the source the reminder
 * automation reads.
 *
 * Past due is computed from `dueDate`, not from the stored `overdue` status, so
 * a loan is reported the moment it is late even if the daily sweep has not run
 * yet. A returned loan is never included, and a loan due today is not late.
 *
 * `asOf` is required rather than defaulted: the caller (the signed n8n
 * endpoint, or a test) names the day the list is computed for, so this query
 * never reads the wall clock.
 */

const overdueViewValidator = v.object({
  loanId: v.id("loans"),
  toolName: v.string(),
  borrowerName: v.union(v.string(), v.null()),
  borrowerEmail: v.string(),
  ownerName: v.union(v.string(), v.null()),
  ownerEmail: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  dueDate: v.string(),
  daysOverdue: v.number(),
});

function resolveAsOf(asOf: string): string {
  if (!isIsoDate(asOf)) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "asOf must be a date in YYYY-MM-DD form.",
    });
  }
  return asOf;
}

/** The overdue list itself, shared by the admin query and the signed endpoint. */
async function collectOverdue(ctx: QueryCtx, asOf: string) {
  const open: Array<{ status: "active" | "overdue" }> = [
    { status: "active" },
    { status: "overdue" },
  ];

  const late = [];
  for (const { status } of open) {
    const rows = await ctx.db
      .query("loans")
      .withIndex("by_status_due", (q) =>
        q.eq("status", status).lt("dueDate", asOf),
      )
      .collect();
    late.push(...rows.filter((loan) => loan.returnedAt === undefined));
  }
  late.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return await Promise.all(
    late.map(async (loan) => {
      const tool = await ctx.db.get(loan.toolId);
      const borrower = await ctx.db.get(loan.borrowerId);
      const owner = await ctx.db.get(loan.ownerId);
      return {
        loanId: loan._id,
        toolName: tool?.name ?? "Removed tool",
        borrowerName: borrower?.name ?? null,
        borrowerEmail: borrower?.email ?? "",
        ownerName: owner?.name ?? null,
        ownerEmail: owner?.email ?? "",
        startDate: loan.startDate,
        endDate: loan.endDate,
        dueDate: loan.dueDate,
        daysOverdue: daysBetween(loan.dueDate, asOf),
      };
    }),
  );
}

export const overdue = query({
  args: { asOf: v.string() },
  returns: v.array(overdueViewValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await collectOverdue(ctx, resolveAsOf(args.asOf));
  },
});

/**
 * The same overdue list for the signed n8n endpoint.
 *
 * Internal on purpose: an HTTP action calls it after verifying the HMAC
 * signature, because n8n has no Clerk identity. Exposing this as a public
 * query would let any signed-in user read every borrower's email.
 */
export const overdueForAutomation = internalQuery({
  args: { asOf: v.string() },
  returns: v.array(overdueViewValidator),
  handler: async (ctx, args) => {
    return await collectOverdue(ctx, resolveAsOf(args.asOf));
  },
});
