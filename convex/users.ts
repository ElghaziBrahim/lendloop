import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findCurrentUser, getOrCreateUser } from "./lib/users";

/**
 * Provision the signed-in Clerk user in Convex.
 *
 * Call `store` from the client once a Clerk session exists (see
 * `src/components/ConvexUserBootstrap.tsx`). It is idempotent: the first call
 * inserts the row and seeds its role from `ADMIN_EMAILS`, later calls only
 * refresh profile fields, so a role changed in the database is not overwritten
 * by a stale allowlist.
 */
export const store = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const user = await getOrCreateUser(ctx);
    return user._id;
  },
});

/**
 * The row for the current caller, or `null` when signed out. The lookup key is
 * the verified token subject, never a client-supplied id.
 */
export const current = query({
  args: {},
  handler: async (ctx) => {
    return await findCurrentUser(ctx);
  },
});
