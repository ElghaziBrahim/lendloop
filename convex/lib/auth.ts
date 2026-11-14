import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Auth helpers shared by every Convex function.
 *
 * Identity always comes from the verified Clerk JWT (`ctx.auth`), never from a
 * function argument.
 */

export type Identity = NonNullable<
  Awaited<ReturnType<QueryCtx["auth"]["getUserIdentity"]>>
>;

export async function requireIdentity(
  ctx: QueryCtx | MutationCtx,
): Promise<Identity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  return identity;
}

/**
 * The verified email on a token, lower-cased. `null` when the Clerk JWT
 * template does not carry the `email` claim; callers turn that into a clear
 * configuration error instead of writing a half-empty row.
 */
export function identityEmail(identity: Identity): string | null {
  const email =
    typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "";
  return email.length > 0 ? email : null;
}
