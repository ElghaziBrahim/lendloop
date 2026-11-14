/**
 * Role seeding.
 *
 * `ADMIN_EMAILS` is a comma-separated allowlist held in the Convex deployment's
 * environment: `npx convex env set ADMIN_EMAILS "you@example.com,teammate@example.com"`.
 *
 * A new user row is created with `role: "admin"` when the verified email from
 * the Clerk token appears in the list, and `role: "user"` otherwise. The first
 * entry is the primary admin: it is the address that gets admin on first
 * sign-in when the list has several entries. Order is otherwise not
 * significant; every listed address seeds as admin.
 *
 * Listing order here is the source of truth for the first admin. Looking up
 * `role` in the database (not in a token claim) keeps authorization
 * server-side: a client cannot promote itself by editing a JWT claim.
 */

import type { Role } from "../schema";

export type { Role };

/**
 * Parse the raw `ADMIN_EMAILS` value into a de-duplicated, lower-cased,
 * order-preserving list. Entries that are not email-shaped are dropped rather
 * than trusted, so a stray space or trailing comma cannot create an empty
 * admin entry.
 */
export function parseAdminEmails(raw: string | undefined | null): string[] {
  if (!raw) return [];

  const seen = new Set<string>();
  const emails: string[] = [];

  for (const part of raw.split(/[,;\s]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || !email.includes("@") || email.startsWith("@")) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  return emails;
}

/** The admin allowlist currently configured on this deployment. */
export function adminEmails(): string[] {
  return parseAdminEmails(process.env.ADMIN_EMAILS);
}

/** The first address in `ADMIN_EMAILS`, i.e. the primary admin, if any. */
export function primaryAdminEmail(): string | null {
  return adminEmails()[0] ?? null;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const normalised = email?.trim().toLowerCase();
  if (!normalised) return false;
  return adminEmails().includes(normalised);
}

/**
 * The role a user row starts with. Only ever applied when the row is created;
 * later sign-ins refresh profile fields and leave `role` alone, so a manual
 * promotion or demotion made by an admin is not silently reverted.
 */
export function roleForNewUser(email: string | null | undefined): Role {
  return isAdminEmail(email) ? "admin" : "user";
}
