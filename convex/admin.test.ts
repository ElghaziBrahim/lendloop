/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import {
  ADMIN_EMAIL,
  BORROWER_EMAIL,
  isoDay,
  OTHER_EMAIL,
  OWNER_EMAIL,
  seedLoan,
  seedRequest,
  seedTool,
  seedUser,
  signIn,
} from "./lib/fixtures";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  return convexTest(schema, modules);
}

async function seedBase(t: ReturnType<typeof setup>) {
  return await t.run(async (ctx) => {
    const owner = await seedUser(ctx, OWNER_EMAIL);
    const admin = await seedUser(ctx, ADMIN_EMAIL, { role: "admin" });
    const borrower = await seedUser(ctx, BORROWER_EMAIL);
    const other = await seedUser(ctx, OTHER_EMAIL);
    const tool = await seedTool(ctx, owner);
    return { owner, admin, borrower, other, tool };
  });
}

async function addLoan(
  t: ReturnType<typeof setup>,
  base: Awaited<ReturnType<typeof seedBase>>,
  options: { startDate: string; endDate: string; status?: "active" | "returned" },
) {
  return await t.run(async (ctx) => {
    const requestId = await seedRequest(ctx, {
      toolId: base.tool,
      ownerId: base.owner,
      requesterId: base.borrower,
      startDate: options.startDate,
      endDate: options.endDate,
      status: "approved",
    });
    return await seedLoan(ctx, {
      toolId: base.tool,
      requestId,
      ownerId: base.owner,
      borrowerId: base.borrower,
      startDate: options.startDate,
      endDate: options.endDate,
      status: options.status,
    });
  });
}

describe("admin.listUsers", () => {
  test("an admin sees every user without Clerk ids", async () => {
    const t = setup();
    await seedBase(t);

    const users = await t
      .withIdentity(signIn(ADMIN_EMAIL))
      .query(api.admin.listUsers, {});

    expect(users.map((user) => user.email)).toEqual([
      ADMIN_EMAIL,
      BORROWER_EMAIL,
      OTHER_EMAIL,
      OWNER_EMAIL,
    ]);
    expect(Object.keys(users[0]).sort()).toEqual([
      "_id",
      "createdAt",
      "email",
      "name",
      "role",
      "trustedLender",
    ]);
  });

  test("a non-admin cannot list users", async () => {
    const t = setup();
    await seedBase(t);

    await expect(
      t.withIdentity(signIn(OTHER_EMAIL)).query(api.admin.listUsers, {}),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
});

describe("admin.setTrustedLender", () => {
  test("an admin can mark and unmark a lender", async () => {
    const t = setup();
    const { owner } = await seedBase(t);
    const admin = t.withIdentity(signIn(ADMIN_EMAIL));

    await admin.mutation(api.admin.setTrustedLender, {
      userId: owner,
      trusted: true,
    });
    expect(await t.run((ctx) => ctx.db.get(owner))).toMatchObject({
      trustedLender: true,
    });

    await admin.mutation(api.admin.setTrustedLender, {
      userId: owner,
      trusted: false,
    });
    expect(await t.run((ctx) => ctx.db.get(owner))).toMatchObject({
      trustedLender: false,
    });
  });

  test("a non-admin cannot, and a missing user is not found", async () => {
    const t = setup();
    const { owner } = await seedBase(t);

    await expect(
      t.withIdentity(signIn(OTHER_EMAIL)).mutation(api.admin.setTrustedLender, {
        userId: owner,
        trusted: true,
      }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });

    await expect(
      t.withIdentity(signIn(ADMIN_EMAIL)).mutation(api.admin.setTrustedLender, {
        userId: owner,
        trusted: true,
      }),
    ).resolves.toEqual(owner);

    await t.run(async (ctx) => {
      await ctx.db.delete(owner);
    });
    await expect(
      t.withIdentity(signIn(ADMIN_EMAIL)).mutation(api.admin.setTrustedLender, {
        userId: owner,
        trusted: true,
      }),
    ).rejects.toMatchObject({ data: { code: "USER_NOT_FOUND" } });
  });
});

describe("admin.removeTool", () => {
  test("an admin can remove another user's listing", async () => {
    const t = setup();
    const { tool } = await seedBase(t);
    const admin = t.withIdentity(signIn(ADMIN_EMAIL));

    await admin.mutation(api.admin.removeTool, { toolId: tool });

    expect(await t.run((ctx) => ctx.db.get(tool))).toMatchObject({
      status: "removed",
    });
    expect(await t.query(api.tools.listPublic, {})).toEqual([]);
  });

  test("a non-admin cannot remove a listing", async () => {
    const t = setup();
    const { tool } = await seedBase(t);

    await expect(
      t
        .withIdentity(signIn(OTHER_EMAIL))
        .mutation(api.admin.removeTool, { toolId: tool }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });

    expect((await t.run((ctx) => ctx.db.get(tool)))?.status).toBe("active");
  });
});

describe("admin.listLoans", () => {
  test("an admin sees every loan, optionally by status", async () => {
    const t = setup();
    const base = await seedBase(t);
    await addLoan(t, base, {
      startDate: isoDay(-2),
      endDate: isoDay(-1),
      status: "active",
    });
    await addLoan(t, base, {
      startDate: isoDay(-5),
      endDate: isoDay(-4),
      status: "returned",
    });

    const admin = t.withIdentity(signIn(ADMIN_EMAIL));
    const all = await admin.query(api.admin.listLoans, {});
    expect(all).toHaveLength(2);
    expect(all.filter((loan) => loan.overdue)).toHaveLength(1);

    const returned = await admin.query(api.admin.listLoans, {
      status: "returned",
    });
    expect(returned).toHaveLength(1);
    expect(returned[0]).toMatchObject({
      borrowerEmail: BORROWER_EMAIL,
      ownerEmail: OWNER_EMAIL,
      toolName: "Cordless drill",
    });
  });

  test("a non-admin cannot list loans", async () => {
    const t = setup();
    await seedBase(t);

    await expect(
      t.withIdentity(signIn(OTHER_EMAIL)).query(api.admin.listLoans, {}),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
});
