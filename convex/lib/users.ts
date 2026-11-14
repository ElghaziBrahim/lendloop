import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { identityEmail, requireIdentity, type Identity } from "./auth";
import { roleForNewUser } from "./roles";

/**
 * Reading and provisioning the `users` row for the current caller.
 *
 * Every domain function gets its user id from here, i.e. from the token
 * subject, never from an argument.
 */

export async function findByClerkId(
  ctx: QueryCtx | MutationCtx,
  clerkId: string,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}

/** The caller's row if it exists, `null` when signed out or not mirrored yet. */
export async function findCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await findByClerkId(ctx, identity.subject);
}

/** The caller's row, creating it on first call and refreshing it afterwards. */
export async function getOrCreateUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const identity = await requireIdentity(ctx);
  const now = Date.now();

  const existing = await findByClerkId(ctx, identity.subject);
  if (existing) {
    const patch = profilePatch(identity, existing);
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existing._id, { ...patch, lastSeenAt: now });
    } else {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
    }
    return { ...existing, ...patch, lastSeenAt: now };
  }

  const email = identityEmail(identity);
  if (!email) {
    throw new ConvexError({
      code: "EMAIL_MISSING",
      message:
        "The Clerk token has no email claim. Add `email` to the `convex` JWT template in Clerk.",
    });
  }

  const id = await ctx.db.insert("users", {
    clerkId: identity.subject,
    email,
    name: stringClaim(identity.name),
    imageUrl: stringClaim(identity.pictureUrl),
    role: roleForNewUser(email),
    trustedLender: false,
    createdAt: now,
    lastSeenAt: now,
  });

  const created = await ctx.db.get(id);
  if (!created) {
    throw new ConvexError({
      code: "USER_WRITE_FAILED",
      message: "Could not read back the newly created user.",
    });
  }
  return created;
}

function stringClaim(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Profile fields that follow the identity provider. `role` and `trustedLender`
 * are deliberately absent: they are owned by the database and by admins.
 */
function profilePatch(identity: Identity, existing: Doc<"users">) {
  const email = identityEmail(identity);
  const name = stringClaim(identity.name);
  const imageUrl = stringClaim(identity.pictureUrl);

  const patch: { email?: string; name?: string; imageUrl?: string } = {};
  if (email && email !== existing.email) patch.email = email;
  if (name && name !== existing.name) patch.name = name;
  if (imageUrl && imageUrl !== existing.imageUrl) patch.imageUrl = imageUrl;
  return patch;
}
