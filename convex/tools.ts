import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { findApprovedConflicts } from "./lib/availability";
import { requireOwnerOrAdmin, requireUser } from "./lib/authz";
import { assertDateRange } from "./lib/dates";
import {
  CATEGORY_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  optionalText,
  requireText,
} from "./lib/validation";
import { toolStatusValidator } from "./schema";

/**
 * Tool listings.
 *
 * `listPublic` is the only function that exposes a listing without a session,
 * and it projects exactly `name` and `category`: no owner id, no description,
 * no timestamps. Everything else is scoped to the caller.
 */

function toolView(tool: Doc<"tools">) {
  return {
    _id: tool._id,
    name: tool.name,
    category: tool.category,
    description: tool.description ?? null,
    status: tool.status,
    createdAt: tool.createdAt,
    updatedAt: tool.updatedAt,
  };
}

/** The exact shape `listMine` and `get` return. */
const toolViewValidator = v.object({
  _id: v.id("tools"),
  name: v.string(),
  category: v.string(),
  description: v.union(v.string(), v.null()),
  status: toolStatusValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

/**
 * The anonymous listing. Returns exactly the two fields a visitor may see;
 * adding an owner field here would leak identity from a public endpoint.
 */
export const listPublic = query({
  args: {},
  returns: v.array(
    v.object({
      name: v.string(),
      category: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(500);

    return tools.map((tool) => ({ name: tool.name, category: tool.category }));
  },
});

/**
 * The shelf as a signed-in member sees it: active tools only, with the owner's
 * display name and the reservations that still stand. Owner identity is
 * available to the circle on purpose (you have to know who you are asking),
 * but only behind a session; the anonymous `listPublic` still returns just
 * name and category.
 *
 * `bookings` reuses the same availability rule the mutations enforce: an
 * approved request blocks its range unless its loan has already been returned.
 * A returned loan is history and is not listed; an unreturned loan past its
 * end date is listed so the shelf can show it as overdue. A pending request is
 * not in the list.
 */
export const listShelf = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("tools"),
      name: v.string(),
      category: v.string(),
      description: v.union(v.string(), v.null()),
      ownerName: v.union(v.string(), v.null()),
      ownerTrusted: v.boolean(),
      ownerIsMe: v.boolean(),
      bookings: v.array(
        v.object({ startDate: v.string(), endDate: v.string() }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const tools = await ctx.db
      .query("tools")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(200);

    const views = await Promise.all(
      tools.map(async (tool) => {
        const owner = await ctx.db.get(tool.ownerId);
        const bookings = await findApprovedConflicts(
          ctx,
          tool._id,
          "0000-01-01",
          "9999-12-31",
        );

        return {
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          description: tool.description ?? null,
          ownerName: owner?.name ?? null,
          ownerTrusted: owner?.trustedLender ?? false,
          ownerIsMe: owner?._id === user._id,
          bookings: bookings.map(({ startDate, endDate }) => ({
            startDate,
            endDate,
          })),
        };
      }),
    );

    return views.sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );
  },
});

/** The caller's own listings, in every state, newest first. */
export const listMine = query({
  args: {},
  returns: v.array(toolViewValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(200);

    return tools.map((tool) => toolView(tool));
  },
});

/** One listing, for its owner or an admin. */
export const get = query({
  args: { toolId: v.id("tools") },
  returns: toolViewValidator,
  handler: async (ctx, args) => {
    const tool = await ctx.db.get(args.toolId);
    if (!tool) {
      throw new ConvexError({
        code: "TOOL_NOT_FOUND",
        message: "That listing no longer exists.",
      });
    }
    await requireOwnerOrAdmin(ctx, tool.ownerId);
    return toolView(tool);
  },
});

/** Whether the tool can be booked for a range, and what is in the way. */
export const availability = query({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
  },
  returns: v.object({
    available: v.boolean(),
    conflicts: v.array(
      v.object({ startDate: v.string(), endDate: v.string() }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    assertDateRange(args.startDate, args.endDate);

    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.status !== "active") {
      throw new ConvexError({
        code: "TOOL_NOT_AVAILABLE",
        message: "That tool is no longer available to borrow.",
      });
    }

    const conflicts = await findApprovedConflicts(
      ctx,
      tool._id,
      args.startDate,
      args.endDate,
    );

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.map(({ startDate, endDate }) => ({
        startDate,
        endDate,
      })),
    };
  },
});

/** List a tool. It belongs to the caller from the moment it exists. */
export const create = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("tools"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    return await ctx.db.insert("tools", {
      ownerId: user._id,
      name: requireText(args.name, "Name", NAME_MAX),
      category: requireText(args.category, "Category", CATEGORY_MAX),
      description: optionalText(
        args.description,
        "Description",
        DESCRIPTION_MAX,
      ),
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Edit a listing. Owner or admin only, enforced here rather than in the form.
 * `description: ""` clears the field.
 */
export const update = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.id("tools"),
  handler: async (ctx, args) => {
    const tool = await ctx.db.get(args.toolId);
    if (!tool) {
      throw new ConvexError({
        code: "TOOL_NOT_FOUND",
        message: "That listing no longer exists.",
      });
    }
    await requireOwnerOrAdmin(ctx, tool.ownerId);

    if (tool.status === "removed") {
      throw new ConvexError({
        code: "TOOL_REMOVED",
        message: "A removed listing cannot be edited.",
      });
    }

    const patch: {
      name?: string;
      category?: string;
      description?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      patch.name = requireText(args.name, "Name", NAME_MAX);
    }
    if (args.category !== undefined) {
      patch.category = requireText(args.category, "Category", CATEGORY_MAX);
    }
    if (args.description !== undefined) {
      patch.description = optionalText(
        args.description,
        "Description",
        DESCRIPTION_MAX,
      );
    }

    await ctx.db.patch(tool._id, patch);
    return tool._id;
  },
});

/**
 * Remove a listing. Soft delete: the row stays so existing requests and loans
 * keep a resolvable reference, and it drops out of the public list because
 * only `active` rows are listed there.
 */
export const remove = mutation({
  args: { toolId: v.id("tools") },
  returns: v.id("tools"),
  handler: async (ctx, args) => {
    const tool = await ctx.db.get(args.toolId);
    if (!tool) {
      throw new ConvexError({
        code: "TOOL_NOT_FOUND",
        message: "That listing no longer exists.",
      });
    }
    await requireOwnerOrAdmin(ctx, tool.ownerId);

    if (tool.status === "active") {
      await ctx.db.patch(tool._id, {
        status: "removed",
        updatedAt: Date.now(),
      });
    }

    return tool._id;
  },
});
