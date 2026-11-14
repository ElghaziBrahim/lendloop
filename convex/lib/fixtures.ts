import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { LoanStatus, RequestStatus, ToolStatus } from "../schema";

/**
 * Test fixtures shared by the convex-test suites.
 *
 * Plain helpers only: no `convex-test` import, so this module stays safe to
 * keep next to the deployed functions. Rows are inserted directly, which also
 * proves the schema accepts them.
 */

export const ADMIN_EMAIL = "admin@example.com";
export const SECOND_ADMIN_EMAIL = "second@example.com";
export const OWNER_EMAIL = "owner@example.com";
export const BORROWER_EMAIL = "borrower@example.com";
export const OTHER_EMAIL = "other@example.com";

/** The identity `convex-test` injects for a seeded email. */
export function signIn(email: string) {
  return {
    subject: `user_${email}`,
    issuer: "https://example.clerk.accounts.dev",
    email,
    emailVerified: true,
    name: email.split("@")[0],
  };
}

export function clerkIdFor(email: string): string {
  return `user_${email}`;
}

/** A `YYYY-MM-DD` date `offset` days from today (UTC). */
export function isoDay(offset = 0, from: number = Date.now()): string {
  return new Date(from + offset * 86_400_000).toISOString().slice(0, 10);
}

export async function seedUser(
  ctx: MutationCtx,
  email: string,
  options: { role?: "admin" | "user"; trustedLender?: boolean; name?: string } = {},
): Promise<Id<"users">> {
  const now = Date.now();
  return await ctx.db.insert("users", {
    clerkId: clerkIdFor(email),
    email: email.trim().toLowerCase(),
    name: options.name ?? email.split("@")[0],
    role: options.role ?? "user",
    trustedLender: options.trustedLender ?? false,
    createdAt: now,
    lastSeenAt: now,
  });
}

export async function seedTool(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  overrides: {
    name?: string;
    category?: string;
    description?: string;
    status?: ToolStatus;
  } = {},
): Promise<Id<"tools">> {
  const now = Date.now();
  return await ctx.db.insert("tools", {
    ownerId,
    name: overrides.name ?? "Cordless drill",
    category: overrides.category ?? "Power tools",
    description: overrides.description,
    status: overrides.status ?? "active",
    createdAt: now,
    updatedAt: now,
  });
}

export async function seedRequest(
  ctx: MutationCtx,
  args: {
    toolId: Id<"tools">;
    ownerId: Id<"users">;
    requesterId: Id<"users">;
    startDate: string;
    endDate: string;
    status?: RequestStatus;
    message?: string;
  },
): Promise<Id<"requests">> {
  return await ctx.db.insert("requests", {
    toolId: args.toolId,
    ownerId: args.ownerId,
    requesterId: args.requesterId,
    startDate: args.startDate,
    endDate: args.endDate,
    message: args.message,
    status: args.status ?? "pending",
    createdAt: Date.now(),
  });
}

export async function seedLoan(
  ctx: MutationCtx,
  args: {
    toolId: Id<"tools">;
    requestId: Id<"requests">;
    ownerId: Id<"users">;
    borrowerId: Id<"users">;
    startDate: string;
    endDate: string;
    dueDate?: string;
    status?: LoanStatus;
    returnedAt?: number;
  },
): Promise<Id<"loans">> {
  return await ctx.db.insert("loans", {
    toolId: args.toolId,
    requestId: args.requestId,
    ownerId: args.ownerId,
    borrowerId: args.borrowerId,
    startDate: args.startDate,
    endDate: args.endDate,
    dueDate: args.dueDate ?? args.endDate,
    status: args.status ?? "active",
    returnedAt: args.returnedAt,
    createdAt: Date.now(),
  });
}
