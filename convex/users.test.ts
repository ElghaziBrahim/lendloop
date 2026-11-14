/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ADMIN = "admin@example.com";
const SECOND_ADMIN = "second@example.com";
const MEMBER = "member@example.com";

let previousAdminEmails: string | undefined;

function setup() {
  return convexTest(schema, modules);
}

function signIn(email: string) {
  return {
    subject: `user_${email}`,
    issuer: "https://example.clerk.accounts.dev",
    email,
    emailVerified: true,
    name: email.split("@")[0],
  };
}

beforeEach(() => {
  previousAdminEmails = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = `${ADMIN}, ${SECOND_ADMIN}`;
});

afterEach(() => {
  if (previousAdminEmails === undefined) {
    delete process.env.ADMIN_EMAILS;
  } else {
    process.env.ADMIN_EMAILS = previousAdminEmails;
  }
});

describe("users.store", () => {
  test("a signed-in caller gets a user row with role user", async () => {
    const t = setup();
    const member = t.withIdentity(signIn(MEMBER));

    const id = await member.mutation(api.users.store, {});
    const row = await member.query(api.users.current, {});

    expect(row).not.toBeNull();
    expect(row?._id).toEqual(id);
    expect(row?.email).toEqual(MEMBER);
    expect(row?.role).toEqual("user");
    expect(row?.trustedLender).toEqual(false);
  });

  test("the first email in ADMIN_EMAILS is seeded as admin", async () => {
    const t = setup();
    const admin = t.withIdentity(signIn(ADMIN));

    await admin.mutation(api.users.store, {});
    const row = await admin.query(api.users.current, {});

    expect(row?.role).toEqual("admin");
  });

  test("a later listed admin email is seeded as admin too", async () => {
    const t = setup();
    const second = t.withIdentity(signIn(SECOND_ADMIN));

    await second.mutation(api.users.store, {});
    const row = await second.query(api.users.current, {});

    expect(row?.role).toEqual("admin");
  });

  test("email matching ignores case and surrounding spaces", async () => {
    const t = setup();
    const admin = t.withIdentity(signIn("ADMIN@Example.com "));

    await admin.mutation(api.users.store, {});

    expect(await admin.query(api.users.current, {})).toMatchObject({
      email: ADMIN,
      role: "admin",
    });
  });

  test("the row is created once and the role survives a later sign-in", async () => {
    const t = setup();
    const member = t.withIdentity(signIn(MEMBER));

    const first = await member.mutation(api.users.store, {});
    // The allowlist changes after the first sign-in; the stored role must not.
    process.env.ADMIN_EMAILS = MEMBER;
    const second = await member.mutation(api.users.store, {});

    expect(second).toEqual(first);

    const rows = await t.run(async (ctx) => await ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toEqual("user");
  });

  test("a caller with no token cannot create a row", async () => {
    const t = setup();

    await expect(t.mutation(api.users.store, {})).rejects.toThrow(/Sign in/i);
    expect(await t.query(api.users.current, {})).toBeNull();
    expect(await t.run(async (ctx) => await ctx.db.query("users").collect())).toHaveLength(0);
  });

  test("a token without an email claim is rejected with a clear code", async () => {
    const t = setup();
    const noEmail = t.withIdentity({ subject: "user_no_email" });

    await expect(noEmail.mutation(api.users.store, {})).rejects.toMatchObject({
      data: { code: "EMAIL_MISSING" },
    });
  });
});

describe("ADMIN_EMAILS parsing", () => {
  test("entries are trimmed, lower-cased, de-duplicated and order-preserving", async () => {
    process.env.ADMIN_EMAILS = " First@Example.com ,second@example.com,first@example.com,, ";

    const { adminEmails, primaryAdminEmail } = await import("./lib/roles");

    expect(adminEmails()).toEqual(["first@example.com", "second@example.com"]);
    expect(primaryAdminEmail()).toEqual("first@example.com");
  });

  test("an unset or junk value yields no admins", async () => {
    delete process.env.ADMIN_EMAILS;
    const { adminEmails, primaryAdminEmail } = await import("./lib/roles");

    expect(adminEmails()).toEqual([]);
    expect(primaryAdminEmail()).toBeNull();
  });
});
