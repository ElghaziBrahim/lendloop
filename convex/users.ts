import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findCurrentUser, getOrCreateUser } from "./lib/users";
import { roleValidator } from "./schema";

/**
 * Provision the signed-in Clerk user in Convex.
 *
 * Call `store` from the client once a Clerk session exists (see
 * `src/components/ConvexUserBootstrap.tsx`). It is idempotent: the first call
 * inserts the row and seeds its role from `ADMIN_EMAILS`, later calls only
 * refresh profile fields, so a role changed in the database is not overwritten
 * by a stale allowlist.
 *
 * The lookup key is `identity.subject`, not `identity.tokenIdentifier`. One
 * Clerk issuer is configured (`convex/auth.config.ts`), and a subject is
 * stable across sessions for that issuer, so a migration to the composite
 * `tokenIdentifier` would add churn without changing any authorization
 * decision. If a second issuer is ever accepted, revisit this and migrate the
 * stored `clerkId` values.
 */
export const store = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const user = await getOrCreateUser(ctx);
    return user._id;
  },
});

/** The caller's own row. `clerkId` is server-side only and is not returned. */
const currentUserValidator = v.object({
  _id: v.id("users"),
  email: v.string(),
  name: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
  role: roleValidator,
  trustedLender: v.boolean(),
  createdAt: v.number(),
  lastSeenAt: v.number(),
});

/**
 * The row for the current caller, or `null` when signed out. The lookup key is
 * the verified token subject, never a client-supplied id.
 */
export const current = query({
  args: {},
  returns: v.union(currentUserValidator, v.null()),
  handler: async (ctx) => {
    const user = await findCurrentUser(ctx);
    if (!user) return null;

    return {
      _id: user._id,
      email: user.email,
      name: user.name ?? null,
      imageUrl: user.imageUrl ?? null,
      role: user.role,
      trustedLender: user.trustedLender,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt,
    };
  },
});
