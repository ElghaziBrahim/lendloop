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
 * The one exception is an approved request whose loan has already been
 * returned: the item is back, the reservation is over, and the slot can be
 * booked again. This keeps a returned-early loan from blocking the tool for
 * the rest of its original range.
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
  const approved = await ctx.db
    .query("requests")
    .withIndex("by_tool_status", (q) =>
      q.eq("toolId", toolId).eq("status", "approved"),
    )
    .collect();

  const conflicts: DateConflict[] = [];

  for (const request of approved) {
    if (request._id === excludeRequestId) continue;
    if (!rangesOverlap(startDate, endDate, request.startDate, request.endDate)) {
      continue;
    }

    const loan = await ctx.db
      .query("loans")
      .withIndex("by_request", (q) => q.eq("requestId", request._id))
      .unique();
    if (loan?.status === "returned") continue;

    conflicts.push({
      requestId: request._id,
      startDate: request.startDate,
      endDate: request.endDate,
    });
  }

  return conflicts;
}
