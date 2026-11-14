import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireIdentity } from "./auth";
import { findByClerkId } from "./users";

/**
 * Authorization helpers.
 *
 * Every rule below reads the caller from the verified Clerk token and the
 * `users` row in the database. Nothing here trusts an argument: a function may
 * accept a `userId` or an `ownerId`, but only as the *thing to check against*,
 * never as the identity to act as.
 */

/** The signed-in caller's row. Throws UNAUTHENTICATED / USER_NOT_SYNCED. */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await requireIdentity(ctx);
  const user = await findByClerkId(ctx, identity.subject);
  if (!user) {
    throw new ConvexError({
      code: "USER_NOT_SYNCED",
      message: "Your account is still being set up. Refresh and try again.",
    });
  }
  return user;
}

/** The caller's row, requiring `role: "admin"` from the database. */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Admins only.",
    });
  }
  return user;
}

/**
 * The caller, when they own the resource (`ownerId`) or are an admin.
 *
 * Used for tool listings (owner), requests (owner for decisions, requester for
 * cancellation) and loans (lender for returns). An admin passes everywhere,
 * because the admin surface is allowed to act on any listing or loan.
 */
export async function requireOwnerOrAdmin(
  ctx: QueryCtx | MutationCtx,
  ownerId: Id<"users">,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role === "admin" || user._id === ownerId) return user;

  throw new ConvexError({
    code: "FORBIDDEN",
    message: "You do not have permission to do that.",
  });
}
