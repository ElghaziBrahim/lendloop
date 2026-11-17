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
    const other = await seedUser(ctx, OTHER_EMAIL);
    const borrower = await seedUser(ctx, BORROWER_EMAIL);
    const tool = await seedTool(ctx, owner);
    return { owner, admin, other, borrower, tool };
  });
}

describe("tools.create", () => {
  test("stores an active listing owned by the caller, trimming text", async () => {
    const t = setup();
    await t.run((ctx) => seedUser(ctx, OWNER_EMAIL));
    const owner = t.withIdentity(signIn(OWNER_EMAIL));

    const id = await owner.mutation(api.tools.create, {
      name: "  Extension ladder ",
      category: " Garden ",
    });

    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row).toMatchObject({
      name: "Extension ladder",
      category: "Garden",
      status: "active",
    });
  });

  test("refuses a blank name or an over-long category", async () => {
    const t = setup();
    await t.run((ctx) => seedUser(ctx, OWNER_EMAIL));
    const owner = t.withIdentity(signIn(OWNER_EMAIL));

    await expect(
      owner.mutation(api.tools.create, { name: "  ", category: "Garden" }),
    ).rejects.toMatchObject({ data: { code: "INVALID_ARGUMENT" } });

    await expect(
      owner.mutation(api.tools.create, {
        name: "Ladder",
        category: "x".repeat(41),
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_ARGUMENT" } });
  });

  test("a signed-out caller cannot create", async () => {
    const t = setup();

    await expect(
      t.mutation(api.tools.create, { name: "Ladder", category: "Garden" }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });
});

describe("tools.listPublic", () => {
  test("returns exactly name and category for active tools only", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      const owner = await seedUser(ctx, OWNER_EMAIL);
      await seedTool(ctx, owner, {
        name: "Cordless drill",
        category: "Power tools",
      });
      await seedTool(ctx, owner, {
        name: "Removed saw",
        category: "Power tools",
        status: "removed",
      });
    });

    // No identity: this is the anonymous page.
    const rows = await t.query(api.tools.listPublic, {});

    expect(rows).toEqual([
      { name: "Cordless drill", category: "Power tools" },
    ]);
    expect(Object.keys(rows[0]).sort()).toEqual(["category", "name"]);
  });
});

describe("tools.listMine", () => {
  test("returns only the caller's listings", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      const owner = await seedUser(ctx, OWNER_EMAIL);
      const other = await seedUser(ctx, OTHER_EMAIL);
      await seedTool(ctx, owner, { name: "Owner drill" });
      await seedTool(ctx, other, { name: "Other drill" });
    });

    const mine = await t
      .withIdentity(signIn(OWNER_EMAIL))
      .query(api.tools.listMine, {});

    expect(mine.map((tool) => tool.name)).toEqual(["Owner drill"]);
  });
});

describe("tools.update", () => {
  test("the owner can edit their listing", async () => {
    const t = setup();
    const { tool } = await seedBase(t);

    await t.withIdentity(signIn(OWNER_EMAIL)).mutation(api.tools.update, {
      toolId: tool,
      name: "Impact driver",
      category: "Power tools",
      description: "  Two batteries ",
    });

    const row = await t.run((ctx) => ctx.db.get(tool));
    expect(row).toMatchObject({
      name: "Impact driver",
      description: "Two batteries",
    });
  });

  test("a non-owner cannot update", async () => {
    const t = setup();
    const { tool } = await seedBase(t);

    await expect(
      t.withIdentity(signIn(OTHER_EMAIL)).mutation(api.tools.update, {
        toolId: tool,
        name: "Stolen",
      }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });

    expect((await t.run((ctx) => ctx.db.get(tool)))?.name).toBe(
      "Cordless drill",
    );
  });

  test("an admin can update another user's listing", async () => {
    const t = setup();
    const { tool } = await seedBase(t);

    await t.withIdentity(signIn(ADMIN_EMAIL)).mutation(api.tools.update, {
      toolId: tool,
      name: "Admin renamed",
    });

    expect((await t.run((ctx) => ctx.db.get(tool)))?.name).toBe(
      "Admin renamed",
    );
  });

  test("a removed listing cannot be edited", async () => {
    const t = setup();
    const { owner } = await seedBase(t);
    const tool = await t.run((ctx) =>
      seedTool(ctx, owner, { status: "removed" }),
    );

    await expect(
      t.withIdentity(signIn(OWNER_EMAIL)).mutation(api.tools.update, {
        toolId: tool,
        name: "Back again",
      }),
    ).rejects.toMatchObject({ data: { code: "TOOL_REMOVED" } });
  });
});

describe("tools.remove", () => {
  test("the owner soft-deletes: the row stays, the public list drops it", async () => {
    const t = setup();
    const { tool } = await seedBase(t);

    await t
      .withIdentity(signIn(OWNER_EMAIL))
      .mutation(api.tools.remove, { toolId: tool });

    expect(await t.run((ctx) => ctx.db.get(tool))).toMatchObject({
      status: "removed",
    });
    expect(await t.query(api.tools.listPublic, {})).toEqual([]);
  });

  test("a non-owner cannot remove", async () => {
    const t = setup();
    const { tool } = await seedBase(t);

    await expect(
      t
        .withIdentity(signIn(OTHER_EMAIL))
        .mutation(api.tools.remove, { toolId: tool }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });

    expect((await t.run((ctx) => ctx.db.get(tool)))?.status).toBe("active");
  });

  test("an admin can remove another user's listing", async () => {
    const t = setup();
    const { tool } = await seedBase(t);

    await t
      .withIdentity(signIn(ADMIN_EMAIL))
      .mutation(api.tools.remove, { toolId: tool });

    expect((await t.run((ctx) => ctx.db.get(tool)))?.status).toBe("removed");
  });
});

describe("tools.listShelf", () => {
  test("returns a past booking while its loan is still out", async () => {
    const t = setup();
    const { tool, owner, borrower } = await seedBase(t);
    await t.run(async (ctx) => {
      const outRequest = await seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(-10),
        endDate: isoDay(-8),
        status: "approved",
      });
      await seedLoan(ctx, {
        toolId: tool,
        requestId: outRequest,
        ownerId: owner,
        borrowerId: borrower,
        startDate: isoDay(-10),
        endDate: isoDay(-8),
        dueDate: isoDay(-8),
        status: "overdue",
      });

      // A returned loan from an earlier, separate booking is history: it must
      // not come back as a booking.
      const returnedRequest = await seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(-30),
        endDate: isoDay(-28),
        status: "approved",
      });
      await seedLoan(ctx, {
        toolId: tool,
        requestId: returnedRequest,
        ownerId: owner,
        borrowerId: borrower,
        startDate: isoDay(-30),
        endDate: isoDay(-28),
        dueDate: isoDay(-28),
        status: "returned",
        returnedAt: Date.now(),
      });
    });

    const shelf = await t
      .withIdentity(signIn(BORROWER_EMAIL))
      .query(api.tools.listShelf, {});
    expect(shelf).toHaveLength(1);
    expect(shelf[0].bookings).toEqual([
      { startDate: isoDay(-10), endDate: isoDay(-8) },
    ]);
  });
});

describe("tools.get", () => {
  test("the owner and an admin can read it, another user cannot", async () => {
    const t = setup();
    const { tool } = await seedBase(t);

    expect(
      await t.withIdentity(signIn(OWNER_EMAIL)).query(api.tools.get, { toolId: tool }),
    ).toMatchObject({ name: "Cordless drill" });
    expect(
      await t.withIdentity(signIn(ADMIN_EMAIL)).query(api.tools.get, { toolId: tool }),
    ).toMatchObject({ name: "Cordless drill" });

    await expect(
      t.withIdentity(signIn(OTHER_EMAIL)).query(api.tools.get, { toolId: tool }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
});

describe("tools.availability", () => {
  test("an empty range is available", async () => {
    const t = setup();
    const { tool } = await seedBase(t);

    const result = await t
      .withIdentity(signIn(BORROWER_EMAIL))
      .query(api.tools.availability, {
        toolId: tool,
        startDate: isoDay(1),
        endDate: isoDay(2),
      });

    expect(result).toEqual({ available: true, conflicts: [] });
  });

  test("an overlapping approved request marks the range unavailable", async () => {
    const t = setup();
    const { tool, owner, borrower } = await seedBase(t);
    await t.run((ctx) =>
      seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(5),
        endDate: isoDay(7),
        status: "approved",
      }),
    );

    const overlapping = await t
      .withIdentity(signIn(OTHER_EMAIL))
      .query(api.tools.availability, {
        toolId: tool,
        startDate: isoDay(6),
        endDate: isoDay(8),
      });
    expect(overlapping).toEqual({
      available: false,
      conflicts: [{ startDate: isoDay(5), endDate: isoDay(7) }],
    });

    // The range is inclusive, so the day after the booking is free.
    const adjacent = await t
      .withIdentity(signIn(OTHER_EMAIL))
      .query(api.tools.availability, {
        toolId: tool,
        startDate: isoDay(8),
        endDate: isoDay(9),
      });
    expect(adjacent).toEqual({ available: true, conflicts: [] });
  });

  test("pending and declined requests do not block, a returned loan frees the range", async () => {
    const t = setup();
    const { tool, owner, borrower } = await seedBase(t);

    const pending = await t.run((ctx) =>
      seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(10),
        endDate: isoDay(11),
        status: "pending",
      }),
    );
    await t.run((ctx) =>
      seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(12),
        endDate: isoDay(13),
        status: "declined",
      }),
    );

    const ask = (startDate: string, endDate: string) =>
      t.withIdentity(signIn(BORROWER_EMAIL)).query(api.tools.availability, {
        toolId: tool,
        startDate,
        endDate,
      });

    expect(await ask(isoDay(10), isoDay(11))).toEqual({
      available: true,
      conflicts: [],
    });
    expect(await ask(isoDay(12), isoDay(13))).toEqual({
      available: true,
      conflicts: [],
    });

    // Approve the pending one -> blocked; return its loan -> free again.
    await t.run((ctx) =>
      ctx.db.patch(pending, { status: "approved", decidedAt: Date.now() }),
    );
    expect(await ask(isoDay(10), isoDay(11))).toEqual({
      available: false,
      conflicts: [{ startDate: isoDay(10), endDate: isoDay(11) }],
    });

    await t.run(async (ctx) => {
      const request = await ctx.db.get(pending);
      if (!request) throw new Error("request missing");
      const loanId = await ctx.db.insert("loans", {
        toolId: tool,
        requestId: pending,
        ownerId: owner,
        borrowerId: borrower,
        startDate: request.startDate,
        endDate: request.endDate,
        dueDate: request.endDate,
        status: "returned",
        returnedAt: Date.now(),
        createdAt: Date.now(),
      });
      return loanId;
    });
    expect(await ask(isoDay(10), isoDay(11))).toEqual({
      available: true,
      conflicts: [],
    });
  });

  test("an overdue loan blocks every future range", async () => {
    const t = setup();
    const { tool, owner, borrower } = await seedBase(t);
    await t.run(async (ctx) => {
      const requestId = await seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(-10),
        endDate: isoDay(-8),
        status: "approved",
      });
      await seedLoan(ctx, {
        toolId: tool,
        requestId,
        ownerId: owner,
        borrowerId: borrower,
        startDate: isoDay(-10),
        endDate: isoDay(-8),
        dueDate: isoDay(-8),
        status: "overdue",
      });
    });

    const result = await t
      .withIdentity(signIn(OTHER_EMAIL))
      .query(api.tools.availability, {
        toolId: tool,
        startDate: isoDay(30),
        endDate: isoDay(32),
      });
    expect(result).toEqual({
      available: false,
      // The real booking dates, not the synthetic blocking end.
      conflicts: [{ startDate: isoDay(-10), endDate: isoDay(-8) }],
    });
  });

  test("rejects an invalid range and a removed tool", async () => {
    const t = setup();
    const { tool, owner } = await seedBase(t);
    const caller = t.withIdentity(signIn(BORROWER_EMAIL));

    await expect(
      caller.query(api.tools.availability, {
        toolId: tool,
        startDate: isoDay(3),
        endDate: isoDay(1),
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_DATE_RANGE" } });

    const removed = await t.run((ctx) =>
      seedTool(ctx, owner, { status: "removed" }),
    );
    await expect(
      caller.query(api.tools.availability, {
        toolId: removed,
        startDate: isoDay(1),
        endDate: isoDay(2),
      }),
    ).rejects.toMatchObject({ data: { code: "TOOL_NOT_AVAILABLE" } });
  });
});
