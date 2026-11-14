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

describe("requests.create", () => {
  test("stores a pending request with the tool's owner denormalised", async () => {
    const t = setup();
    const { tool, owner } = await seedBase(t);

    const id = await t
      .withIdentity(signIn(BORROWER_EMAIL))
      .mutation(api.requests.create, {
        toolId: tool,
        startDate: isoDay(1),
        endDate: isoDay(2),
        message: "  I can collect Saturday ",
      });

    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row).toMatchObject({
      toolId: tool,
      ownerId: owner,
      startDate: isoDay(1),
      endDate: isoDay(2),
      message: "I can collect Saturday",
      status: "pending",
    });
  });

  test("refuses your own tool", async () => {
    const t = setup();
    const { tool } = await seedBase(t);

    await expect(
      t.withIdentity(signIn(OWNER_EMAIL)).mutation(api.requests.create, {
        toolId: tool,
        startDate: isoDay(1),
        endDate: isoDay(2),
      }),
    ).rejects.toMatchObject({ data: { code: "OWN_TOOL" } });
  });

  test("refuses a removed or missing tool", async () => {
    const t = setup();
    const { owner } = await seedBase(t);
    const removed = await t.run((ctx) =>
      seedTool(ctx, owner, { status: "removed" }),
    );
    const caller = t.withIdentity(signIn(BORROWER_EMAIL));

    await expect(
      caller.mutation(api.requests.create, {
        toolId: removed,
        startDate: isoDay(1),
        endDate: isoDay(2),
      }),
    ).rejects.toMatchObject({ data: { code: "TOOL_NOT_AVAILABLE" } });
  });

  test("validates the date range", async () => {
    const t = setup();
    const { tool } = await seedBase(t);
    const caller = t.withIdentity(signIn(BORROWER_EMAIL));

    await expect(
      caller.mutation(api.requests.create, {
        toolId: tool,
        startDate: isoDay(3),
        endDate: isoDay(2),
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_DATE_RANGE" } });

    await expect(
      caller.mutation(api.requests.create, {
        toolId: tool,
        startDate: "2026-3-1",
        endDate: isoDay(2),
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_DATE_RANGE" } });
  });

  test("an overlapping approved request blocks a new request", async () => {
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

    await expect(
      t.withIdentity(signIn(OTHER_EMAIL)).mutation(api.requests.create, {
        toolId: tool,
        startDate: isoDay(7),
        endDate: isoDay(9),
      }),
    ).rejects.toMatchObject({ data: { code: "TOOL_UNAVAILABLE" } });
  });

  test("a second overlapping live request from the same borrower is refused", async () => {
    const t = setup();
    const { tool } = await seedBase(t);
    const caller = t.withIdentity(signIn(BORROWER_EMAIL));

    await caller.mutation(api.requests.create, {
      toolId: tool,
      startDate: isoDay(10),
      endDate: isoDay(12),
    });

    await expect(
      caller.mutation(api.requests.create, {
        toolId: tool,
        startDate: isoDay(12),
        endDate: isoDay(13),
      }),
    ).rejects.toMatchObject({ data: { code: "ALREADY_REQUESTED" } });
  });

  test("a signed-out caller cannot request", async () => {
    const t = setup();
    const { tool } = await seedBase(t);

    await expect(
      t.mutation(api.requests.create, {
        toolId: tool,
        startDate: isoDay(1),
        endDate: isoDay(2),
      }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });
});

describe("requests.decide", () => {
  test("the owner can approve; an active loan is created with dueDate = endDate", async () => {
    const t = setup();
    const { tool, owner, borrower } = await seedBase(t);
    const request = await t.run((ctx) =>
      seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(1),
        endDate: isoDay(4),
      }),
    );

    await t
      .withIdentity(signIn(OWNER_EMAIL))
      .mutation(api.requests.approve, { requestId: request });

    expect(await t.run((ctx) => ctx.db.get(request))).toMatchObject({
      status: "approved",
      decidedBy: owner,
    });

    const loans = await t.run((ctx) => ctx.db.query("loans").collect());
    expect(loans).toHaveLength(1);
    expect(loans[0]).toMatchObject({
      toolId: tool,
      requestId: request,
      borrowerId: borrower,
      ownerId: owner,
      startDate: isoDay(1),
      endDate: isoDay(4),
      dueDate: isoDay(4),
      status: "active",
    });
  });

  test("the owner can decline; no loan is created", async () => {
    const t = setup();
    const { tool, owner, borrower } = await seedBase(t);
    const request = await t.run((ctx) =>
      seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(1),
        endDate: isoDay(2),
      }),
    );

    await t
      .withIdentity(signIn(OWNER_EMAIL))
      .mutation(api.requests.decline, { requestId: request });

    expect(await t.run((ctx) => ctx.db.get(request))).toMatchObject({
      status: "declined",
      decidedBy: owner,
    });
    expect(await t.run((ctx) => ctx.db.query("loans").collect())).toHaveLength(
      0,
    );
  });

  test("a non-owner cannot approve or decline", async () => {
    const t = setup();
    const { tool, owner, borrower } = await seedBase(t);
    const request = await t.run((ctx) =>
      seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(1),
        endDate: isoDay(2),
      }),
    );
    const stranger = t.withIdentity(signIn(OTHER_EMAIL));

    await expect(
      stranger.mutation(api.requests.approve, { requestId: request }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(
      stranger.mutation(api.requests.decline, { requestId: request }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });

    expect(await t.run((ctx) => ctx.db.get(request))).toMatchObject({
      status: "pending",
    });
    expect(await t.run((ctx) => ctx.db.query("loans").collect())).toHaveLength(
      0,
    );
  });

  test("an admin can approve and decline another user's requests", async () => {
    const t = setup();
    const { tool, owner, borrower, admin: adminId } = await seedBase(t);
    const [first, second] = await t.run(async (ctx) => [
      await seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(5),
        endDate: isoDay(6),
      }),
      await seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(8),
        endDate: isoDay(9),
      }),
    ]);

    const admin = t.withIdentity(signIn(ADMIN_EMAIL));
    await admin.mutation(api.requests.approve, { requestId: first });
    await admin.mutation(api.requests.decline, { requestId: second });

    expect(await t.run((ctx) => ctx.db.get(first))).toMatchObject({
      status: "approved",
      decidedBy: adminId,
    });
    expect(await t.run((ctx) => ctx.db.get(second))).toMatchObject({
      status: "declined",
      decidedBy: adminId,
    });
  });

  test("a decided request cannot be decided again", async () => {
    const t = setup();
    const { tool, owner, borrower } = await seedBase(t);
    const request = await t.run((ctx) =>
      seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(1),
        endDate: isoDay(2),
        status: "declined",
      }),
    );

    await expect(
      t
        .withIdentity(signIn(OWNER_EMAIL))
        .mutation(api.requests.approve, { requestId: request }),
    ).rejects.toMatchObject({ data: { code: "ALREADY_DECIDED" } });
  });

  test("approval re-checks availability: only the first overlapping request wins", async () => {
    const t = setup();
    const { tool, owner, borrower, other } = await seedBase(t);
    const [first, second] = await t.run(async (ctx) => [
      await seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(20),
        endDate: isoDay(21),
      }),
      await seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: other,
        startDate: isoDay(21),
        endDate: isoDay(22),
      }),
    ]);
    const ownerCaller = t.withIdentity(signIn(OWNER_EMAIL));

    await ownerCaller.mutation(api.requests.approve, { requestId: first });
    await expect(
      ownerCaller.mutation(api.requests.approve, { requestId: second }),
    ).rejects.toMatchObject({ data: { code: "TOOL_UNAVAILABLE" } });

    expect(await t.run((ctx) => ctx.db.get(second))).toMatchObject({
      status: "pending",
    });
  });
});

describe("requests.cancel", () => {
  test("the requester can cancel a pending request, another user cannot", async () => {
    const t = setup();
    const { tool, owner, borrower } = await seedBase(t);
    const request = await t.run((ctx) =>
      seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(1),
        endDate: isoDay(2),
      }),
    );

    await expect(
      t
        .withIdentity(signIn(OTHER_EMAIL))
        .mutation(api.requests.cancel, { requestId: request }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });

    await t
      .withIdentity(signIn(BORROWER_EMAIL))
      .mutation(api.requests.cancel, { requestId: request });

    expect(await t.run((ctx) => ctx.db.get(request))).toMatchObject({
      status: "cancelled",
    });
  });
});

describe("request visibility", () => {
  test("listMine returns only the caller's requests", async () => {
    const t = setup();
    const { tool, owner, borrower } = await seedBase(t);
    await t.run((ctx) =>
      seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(1),
        endDate: isoDay(2),
        message: "private note",
      }),
    );

    const mine = await t
      .withIdentity(signIn(BORROWER_EMAIL))
      .query(api.requests.listMine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      toolName: "Cordless drill",
      message: "private note",
    });

    expect(
      await t.withIdentity(signIn(OTHER_EMAIL)).query(api.requests.listMine, {}),
    ).toEqual([]);
  });

  test("listIncoming is only for the tool's owner and names the requester", async () => {
    const t = setup();
    const { tool, owner, borrower } = await seedBase(t);
    await t.run((ctx) =>
      seedRequest(ctx, {
        toolId: tool,
        ownerId: owner,
        requesterId: borrower,
        startDate: isoDay(1),
        endDate: isoDay(2),
      }),
    );

    const incoming = await t
      .withIdentity(signIn(OWNER_EMAIL))
      .query(api.requests.listIncoming, {});
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({
      requesterEmail: BORROWER_EMAIL,
      toolName: "Cordless drill",
    });

    expect(
      await t
        .withIdentity(signIn(OTHER_EMAIL))
        .query(api.requests.listIncoming, {}),
    ).toEqual([]);
  });
});
