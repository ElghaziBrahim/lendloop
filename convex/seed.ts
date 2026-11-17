import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";

/**
 * Development seed for the local deployment.
 *
 * Without it the shelf is empty and there is nothing to look at. The rows are
 * demo data only: two example.com lenders and the tools they would lend, plus
 * — once an admin has signed in — a set of requests and loans around that admin
 * so every authenticated view has something to render.
 *
 * `internalMutation` means the browser cannot call this, but the CLI and
 * another Convex function still can, including against production. The
 * `confirm: "seed-demo-data"` argument is therefore required, so running it is
 * always deliberate:
 *
 *     npx convex run seed:dev '{"confirm":"seed-demo-data"}'
 *
 * It is idempotent: the maker user makes a second base run a no-op, and the
 * activity phase is skipped once the admin has any request.
 */

const SEED_MARKER = "seed_maya_chen";
const MS_PER_DAY = 86_400_000;

/** A `YYYY-MM-DD` date `offset` days from today (UTC). */
function isoDay(offset = 0): string {
  return new Date(Date.now() + offset * MS_PER_DAY).toISOString().slice(0, 10);
}

async function userByClerkId(ctx: MutationCtx, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}

async function toolByName(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  name: string,
): Promise<Id<"tools"> | null> {
  const tools = await ctx.db
    .query("tools")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .take(200);
  return tools.find((tool) => tool.name === name)?._id ?? null;
}

/** Insert the two demo lenders and their shelf. Returns their ids. */
async function seedShelf(ctx: MutationCtx) {
  const now = Date.now();

  const maya = await ctx.db.insert("users", {
    clerkId: SEED_MARKER,
    email: "maya.chen@example.com",
    name: "Maya Chen",
    role: "user",
    trustedLender: true,
    createdAt: now,
    lastSeenAt: now,
  });

  const jonas = await ctx.db.insert("users", {
    clerkId: "seed_jonas_weber",
    email: "jonas.weber@example.com",
    name: "Jonas Weber",
    role: "user",
    trustedLender: false,
    createdAt: now,
    lastSeenAt: now,
  });

  const listings: Array<{
    ownerId: Id<"users">;
    name: string;
    category: string;
    description: string;
    status: "active" | "removed";
  }> = [
    {
      ownerId: maya,
      name: "Cordless drill",
      category: "Power tools",
      description: "18V, two batteries and a full bit set.",
      status: "active",
    },
    {
      ownerId: jonas,
      name: "Circular saw",
      category: "Power tools",
      description: "185mm blade, fence and a spare blade.",
      status: "active",
    },
    {
      ownerId: maya,
      name: "Extension ladder",
      category: "Ladders",
      description: "Three metres, aluminium, fits in a hatchback.",
      status: "active",
    },
    {
      ownerId: jonas,
      name: "Two-person tent",
      category: "Camping",
      description: "Three-season tent with a footprint.",
      status: "active",
    },
    {
      ownerId: maya,
      name: "Stand mixer",
      category: "Kitchen",
      description: "Bowl, whisk and dough hook included.",
      status: "active",
    },
    {
      ownerId: jonas,
      name: "Projector",
      category: "Electronics",
      description: "1080p, HDMI and a small tripod screen.",
      status: "active",
    },
    {
      // Deliberately removed: proves the public query filters by status.
      ownerId: jonas,
      name: "Lawn mower",
      category: "Garden",
      description: "Kept for the owner's records, not on the shelf.",
      status: "removed",
    },
  ];

  for (const listing of listings) {
    await ctx.db.insert("tools", {
      ...listing,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { maya, jonas };
}

/**
 * Demo requests and loans for the first admin account.
 *
 * The authenticated views are scoped to the caller, so seeded rows owned by
 * example.com users would leave every one of them empty. This phase attaches
 * activity to the real admin instead: tools they lend, requests they send,
 * incoming asks to decide, and loans in all three states.
 *
 * Skipped when no admin exists yet (sign in once, then run the seed again) and
 * when the admin already has requests, so re-running never duplicates rows.
 */
async function seedActivity(ctx: MutationCtx) {
  const admin = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .first();

  if (!admin) {
    return { created: false, loans: 0 };
  }

  const existing = await ctx.db
    .query("requests")
    .withIndex("by_requester", (q) => q.eq("requesterId", admin._id))
    .first();
  const existingIncoming = await ctx.db
    .query("requests")
    .withIndex("by_owner", (q) => q.eq("ownerId", admin._id))
    .first();

  if (existing || existingIncoming) {
    return { created: false, loans: 0 };
  }

  const maya = await userByClerkId(ctx, SEED_MARKER);
  const jonas = await userByClerkId(ctx, "seed_jonas_weber");
  if (!maya || !jonas) return { created: false, loans: 0 };

  const now = Date.now();

  const ownTools: Array<{
    name: string;
    category: string;
    description: string;
    status: "active" | "removed";
  }> = [
    {
      name: "Impact driver",
      category: "Power tools",
      description: "18V impact driver with two batteries.",
      status: "active",
    },
    {
      name: "Folding workbench",
      category: "Workshop",
      description: "Folds flat, 150kg load, fits in a cupboard.",
      status: "active",
    },
    {
      name: "Socket set",
      category: "Hand tools",
      description: "Metric and imperial sockets in a latch case.",
      status: "active",
    },
    {
      name: "Lawn edger",
      category: "Garden",
      description: "Stored in the shed; no longer lent out.",
      status: "removed",
    },
  ];

  for (const tool of ownTools) {
    const existingTool = await toolByName(ctx, admin._id, tool.name);
    if (existingTool) continue;
    await ctx.db.insert("tools", {
      ownerId: admin._id,
      name: tool.name,
      category: tool.category,
      description: tool.description,
      status: tool.status,
      createdAt: now,
      updatedAt: now,
    });
  }

  const tool = async (ownerId: Id<"users">, name: string) => {
    const id = await toolByName(ctx, ownerId, name);
    if (!id) throw new Error(`Seed data is missing the tool "${name}".`);
    return id;
  };

  const ladder = await tool(maya._id, "Extension ladder");
  const drill = await tool(maya._id, "Cordless drill");
  const projector = await tool(jonas._id, "Projector");
  const tent = await tool(jonas._id, "Two-person tent");
  const saw = await tool(jonas._id, "Circular saw");

  const impactDriver = await tool(admin._id, "Impact driver");
  const workbench = await tool(admin._id, "Folding workbench");
  const socketSet = await tool(admin._id, "Socket set");

  let loans = 0;

  /** A request plus, when approved, the loan it becomes. */
  const add = async (args: {
    toolId: Id<"tools">;
    ownerId: Id<"users">;
    requesterId: Id<"users">;
    startDate: string;
    endDate: string;
    status: "pending" | "approved" | "declined";
    message?: string;
    createdAt: number;
    returnedAt?: number;
  }): Promise<Id<"requests">> => {
    const isApproved = args.status === "approved";
    const requestId = await ctx.db.insert("requests", {
      toolId: args.toolId,
      ownerId: args.ownerId,
      requesterId: args.requesterId,
      startDate: args.startDate,
      endDate: args.endDate,
      message: args.message,
      status: args.status,
      decidedAt: args.status === "pending" ? undefined : args.createdAt + MS_PER_DAY,
      decidedBy: args.status === "pending" ? undefined : args.ownerId,
      createdAt: args.createdAt,
    });

    if (isApproved) {
      await ctx.db.insert("loans", {
        toolId: args.toolId,
        requestId,
        borrowerId: args.requesterId,
        ownerId: args.ownerId,
        startDate: args.startDate,
        endDate: args.endDate,
        dueDate: args.endDate,
        status: args.returnedAt === undefined ? "active" : "returned",
        returnedAt: args.returnedAt,
        returnedBy: args.returnedAt === undefined ? undefined : args.ownerId,
        createdAt: args.createdAt,
      });
      loans += 1;
    }

    return requestId;
  };

  // Requests the admin made.

  await add({
    toolId: ladder,
    ownerId: maya._id,
    requesterId: admin._id,
    startDate: isoDay(14),
    endDate: isoDay(16),
    status: "pending",
    message: "The gutters need doing before the rain.",
    createdAt: now - 2 * MS_PER_DAY,
  });

  await add({
    toolId: projector,
    ownerId: jonas._id,
    requesterId: admin._id,
    startDate: isoDay(-1),
    endDate: isoDay(3),
    status: "approved",
    message: "Film night at the weekend.",
    createdAt: now - 6 * MS_PER_DAY,
  });

  await add({
    toolId: tent,
    ownerId: jonas._id,
    requesterId: admin._id,
    startDate: isoDay(-12),
    endDate: isoDay(-5),
    status: "approved",
    message: "Two nights in the hills.",
    createdAt: now - 18 * MS_PER_DAY,
  });

  await add({
    toolId: drill,
    ownerId: maya._id,
    requesterId: admin._id,
    startDate: isoDay(-20),
    endDate: isoDay(-18),
    status: "approved",
    message: "Hanging shelves.",
    createdAt: now - 26 * MS_PER_DAY,
    returnedAt: now - 18 * MS_PER_DAY,
  });

  await add({
    toolId: saw,
    ownerId: jonas._id,
    requesterId: admin._id,
    startDate: isoDay(20),
    endDate: isoDay(21),
    status: "declined",
    message: "Cutting a worktop.",
    createdAt: now - 9 * MS_PER_DAY,
  });

  // Requests for the admin's tools.

  await add({
    toolId: impactDriver,
    ownerId: admin._id,
    requesterId: maya._id,
    startDate: isoDay(5),
    endDate: isoDay(7),
    status: "pending",
    message: "Building a shed, need it for the frame.",
    createdAt: now - MS_PER_DAY,
  });

  await add({
    toolId: workbench,
    ownerId: admin._id,
    requesterId: jonas._id,
    startDate: isoDay(9),
    endDate: isoDay(10),
    status: "pending",
    message: "Two days should be enough for the bench build.",
    createdAt: now - 3 * MS_PER_DAY,
  });

  await add({
    toolId: socketSet,
    ownerId: admin._id,
    requesterId: maya._id,
    startDate: isoDay(-3),
    endDate: isoDay(-2),
    status: "declined",
    message: "Quick bike repair.",
    createdAt: now - 7 * MS_PER_DAY,
  });

  await add({
    toolId: workbench,
    ownerId: admin._id,
    requesterId: maya._id,
    startDate: isoDay(-2),
    endDate: isoDay(2),
    status: "approved",
    message: "Sandwiching a door.",
    createdAt: now - 8 * MS_PER_DAY,
  });

  await add({
    toolId: socketSet,
    ownerId: admin._id,
    requesterId: jonas._id,
    startDate: isoDay(-30),
    endDate: isoDay(-28),
    status: "approved",
    message: "Fixing the bike rack.",
    createdAt: now - 35 * MS_PER_DAY,
    returnedAt: now - 28 * MS_PER_DAY,
  });

  return { created: true, loans };
}

export const dev = internalMutation({
  args: { confirm: v.optional(v.literal("seed-demo-data")) },
  returns: v.object({
    seeded: v.boolean(),
    tools: v.number(),
    demo: v.boolean(),
    demoLoans: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.confirm !== "seed-demo-data") {
      throw new ConvexError({
        code: "SEED_NOT_CONFIRMED",
        message:
          "This writes demo rows. Run `npx convex run seed:dev '{\"confirm\":\"seed-demo-data\"}'` to confirm.",
      });
    }

    const existing = await userByClerkId(ctx, SEED_MARKER);

    if (!existing) {
      await seedShelf(ctx);
    }

    const activity = await seedActivity(ctx);
    const tools = await ctx.db.query("tools").take(1000);

    return {
      seeded: !existing,
      tools: tools.length,
      demo: activity.created,
      demoLoans: activity.loans,
    };
  },
});
