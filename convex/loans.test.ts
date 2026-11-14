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
  options: {
    startDate: string;
    endDate: string;
    dueDate?: string;
    status?: "active" | "overdue" | "returned";
    returnedAt?: number;
  },
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
    const loanId = await seedLoan(ctx, {
      toolId: base.tool,
      requestId,
      ownerId: base.owner,
      borrowerId: base.borrower,
      startDate: options.startDate,
      endDate: options.endDate,
      dueDate: options.dueDate,
      status: options.status,
      returnedAt: options.returnedAt,
    });
    return { requestId, loanId };
  });
}

describe("loans.markReturned", () => {
  test("the lender confirms a return and a repeat call keeps the first timestamp", async () => {
    const t = setup();
    const base = await seedBase(t);
    const { loanId } = await addLoan(t, base, {
      startDate: isoDay(-3),
      endDate: isoDay(-1),
    });
    const lender = t.withIdentity(signIn(OWNER_EMAIL));

    await lender.mutation(api.loans.markReturned, { loanId });
    const first = await t.run((ctx) => ctx.db.get(loanId));
    expect(first).toMatchObject({
      status: "returned",
      returnedBy: base.owner,
    });
    expect(typeof first?.returnedAt).toBe("number");

    await lender.mutation(api.loans.markReturned, { loanId });
    const second = await t.run((ctx) => ctx.db.get(loanId));
    expect(second?.returnedAt).toEqual(first?.returnedAt);
  });

  test("the borrower and an unrelated user cannot mark it returned", async () => {
    const t = setup();
    const base = await seedBase(t);
    const { loanId } = await addLoan(t, base, {
      startDate: isoDay(-3),
      endDate: isoDay(-1),
    });

    for (const email of [BORROWER_EMAIL, OTHER_EMAIL]) {
      await expect(
        t
          .withIdentity(signIn(email))
          .mutation(api.loans.markReturned, { loanId }),
      ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    }

    expect(await t.run((ctx) => ctx.db.get(loanId))).toMatchObject({
      status: "active",
    });
  });

  test("an admin can mark any loan returned", async () => {
    const t = setup();
    const base = await seedBase(t);
    const { loanId } = await addLoan(t, base, {
      startDate: isoDay(-3),
      endDate: isoDay(-1),
    });

    await t
      .withIdentity(signIn(ADMIN_EMAIL))
      .mutation(api.loans.markReturned, { loanId });

    expect(await t.run((ctx) => ctx.db.get(loanId))).toMatchObject({
      status: "returned",
      returnedBy: base.admin,
    });
  });
});

describe("loans.overdue", () => {
  test("returns only past-due loans that have not been returned", async () => {
    const t = setup();
    const base = await seedBase(t);

    const longOverdue = await addLoan(t, base, {
      startDate: "2026-06-01",
      endDate: "2026-06-10",
      dueDate: "2026-06-10",
      status: "overdue",
    });
    const yesterday = await addLoan(t, base, {
      startDate: "2026-06-05",
      endDate: "2026-06-14",
      dueDate: "2026-06-14",
      status: "active",
    });
    await addLoan(t, base, {
      startDate: "2026-06-06",
      endDate: "2026-06-15",
      dueDate: "2026-06-15",
      status: "active",
    });
    await addLoan(t, base, {
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      dueDate: "2026-07-02",
      status: "active",
    });
    await addLoan(t, base, {
      startDate: "2026-05-01",
      endDate: "2026-06-01",
      dueDate: "2026-06-01",
      status: "returned",
      returnedAt: Date.now(),
    });

    const rows = await t
      .withIdentity(signIn(ADMIN_EMAIL))
      .query(api.loans.overdue, { asOf: "2026-06-15" });

    expect(rows.map((row) => row.loanId)).toEqual([
      longOverdue.loanId,
      yesterday.loanId,
    ]);
    expect(rows[0]).toMatchObject({
      dueDate: "2026-06-10",
      daysOverdue: 5,
      toolName: "Cordless drill",
      borrowerEmail: BORROWER_EMAIL,
      ownerEmail: OWNER_EMAIL,
    });
    expect(rows[1]).toMatchObject({
      dueDate: "2026-06-14",
      daysOverdue: 1,
    });
  });

  test("is admin only", async () => {
    const t = setup();

    await expect(t.query(api.loans.overdue, {})).rejects.toMatchObject({
      data: { code: "UNAUTHENTICATED" },
    });
  });

  test("refuses a non-admin and an invalid asOf", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      await seedUser(ctx, BORROWER_EMAIL);
    });

    await expect(
      t.withIdentity(signIn(BORROWER_EMAIL)).query(api.loans.overdue, {}),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });

    await t.run((ctx) => seedUser(ctx, ADMIN_EMAIL, { role: "admin" }));
    await expect(
      t
        .withIdentity(signIn(ADMIN_EMAIL))
        .query(api.loans.overdue, { asOf: "15-06-2026" }),
    ).rejects.toMatchObject({ data: { code: "INVALID_ARGUMENT" } });
  });
});

describe("loan visibility", () => {
  test("listMine is the borrower's own loans, with a computed overdue flag", async () => {
    const t = setup();
    const base = await seedBase(t);

    await addLoan(t, base, {
      startDate: isoDay(-5),
      endDate: isoDay(-1),
      dueDate: isoDay(-1),
      status: "active",
    });
    await addLoan(t, base, {
      startDate: isoDay(-5),
      endDate: isoDay(-2),
      dueDate: isoDay(-2),
      status: "returned",
      returnedAt: Date.now(),
    });

    const mine = await t
      .withIdentity(signIn(BORROWER_EMAIL))
      .query(api.loans.listMine, {});
    expect(mine).toHaveLength(2);
    expect(
      mine.filter((loan) => loan.overdue).map((loan) => loan.status),
    ).toEqual(["active"]);

    expect(
      await t.withIdentity(signIn(OTHER_EMAIL)).query(api.loans.listMine, {}),
    ).toEqual([]);
  });

  test("listIncoming is the lender's own loans and names the borrower", async () => {
    const t = setup();
    const base = await seedBase(t);
    await addLoan(t, base, {
      startDate: isoDay(-1),
      endDate: isoDay(1),
    });

    const incoming = await t
      .withIdentity(signIn(OWNER_EMAIL))
      .query(api.loans.listIncoming, {});
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({
      borrowerEmail: BORROWER_EMAIL,
      toolName: "Cordless drill",
    });

    expect(
      await t
        .withIdentity(signIn(OTHER_EMAIL))
        .query(api.loans.listIncoming, {}),
    ).toEqual([]);
  });
});
