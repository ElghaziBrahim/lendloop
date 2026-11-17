import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { rangesOverlap } from "./dates";

/**
 * Availability.
 *
 * An approved request is the reservation ledger: approving one is what makes a
 * tool unavailable, and the loan it creates inherits the same range. A request
 * that is pending, declined or cancelled never blocks, because the owner has
 * not committed to it.
 *
 * Two exceptions matter. A loan that has been returned no longer blocks: the
 * item is back and the slot can be booked again, even inside the original
 * range. A loan that is still out past its due date (`status: "overdue"`)
 * blocks every future date, because the item is not back yet and the next
 * booking cannot know when it will be. A loan still `active` blocks only its
 * approved range; the daily sweep in `loans.markOverdue` is what moves it to
 * `overdue` once its due date has passed.
 */

export type DateConflict = {
  requestId: Id<"requests">;
  startDate: string;
  endDate: string;
};

export async function findApprovedConflicts(
  ctx: QueryCtx | MutationCtx,
  toolId: Id<"tools">,
  startDate: string,
  endDate: string,
  excludeRequestId?: Id<"requests">,
): Promise<DateConflict[]> {
  // Newest first, so the cap keeps the most recent approvals: those are the
  // ones that can still be live. Without the order, the cap would read the
  // oldest approvals and could miss a current booking.
  const approved = await ctx.db
    .query("requests")
    .withIndex("by_tool_status", (q) =>
      q.eq("toolId", toolId).eq("status", "approved"),
    )
    .order("desc")
    .take(200);

  const conflicts: DateConflict[] = [];

  for (const request of approved) {
    if (request._id === excludeRequestId) continue;

    const loan = await ctx.db
      .query("loans")
      .withIndex("by_request", (q) => q.eq("requestId", request._id))
      .unique();
    if (loan?.status === "returned") continue;

    // An overdue loan blocks every future date. The request still reports its
    // real dates so the caller can see what is out.
    const effectiveEnd =
      loan?.status === "overdue" ? "9999-12-31" : request.endDate;
    if (!rangesOverlap(startDate, endDate, request.startDate, effectiveEnd)) {
      continue;
    }

    conflicts.push({
      requestId: request._id,
      startDate: request.startDate,
      endDate: request.endDate,
    });
  }

  return conflicts;
}
