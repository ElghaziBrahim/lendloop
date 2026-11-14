import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * LendLoop data model.
 *
 * Calendar dates (`startDate`, `endDate`, `dueDate`) are ISO `YYYY-MM-DD`
 * strings, not timestamps: a loan is taken for a day range, not an instant,
 * and string comparison gives correct overlap tests for that format. Everything
 * else that is a moment in time (`createdAt`, `returnedAt`, ...) is epoch
 * milliseconds.
 */

export const roleValidator = v.union(v.literal("admin"), v.literal("user"));
export type Role = "admin" | "user";

export const toolStatusValidator = v.union(
  v.literal("active"),
  v.literal("removed"),
);
export type ToolStatus = "active" | "removed";

export const requestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
);
export type RequestStatus = "pending" | "approved" | "declined" | "cancelled";

export const loanStatusValidator = v.union(
  v.literal("active"),
  v.literal("overdue"),
  v.literal("returned"),
);
export type LoanStatus = "active" | "overdue" | "returned";

export const reminderKindValidator = v.union(
  v.literal("due_soon"),
  v.literal("overdue"),
);
export type ReminderKind = "due_soon" | "overdue";

export const reminderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("failed"),
);
export type ReminderStatus = "pending" | "sent" | "failed";

export const automationDirectionValidator = v.union(
  v.literal("outbound"),
  v.literal("inbound"),
);
export type AutomationDirection = "outbound" | "inbound";

export const automationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("delivered"),
  v.literal("failed"),
  v.literal("ignored"),
);
export type AutomationStatus = "pending" | "delivered" | "failed" | "ignored";

const schema = defineSchema({
  /**
   * One row per signed-in Clerk user. `clerkId` is the token subject; `email`
   * is copied from the verified token so it can be shown to other users
   * without a Clerk round trip. `role` is the authorization source of truth and
   * is never read from a client-supplied value.
   */
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: roleValidator,
    /** Set by an admin; a trust signal shown on the public listing. */
    trustedLender: v.boolean(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  /**
   * A lendable item. Removal is soft (`status: "removed"`) so existing
   * requests and loans keep a resolvable reference; only `active` rows appear
   * on the public page.
   */
  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: v.string(),
    description: v.optional(v.string()),
    status: toolStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"])
    .index("by_owner_status", ["ownerId", "status"]),

  /**
   * A borrower's ask for a tool over a date range. `ownerId` is denormalised
   * from the tool so an owner's inbox and the decision mutation can authorize
   * without reading the tool first.
   */
  requests: defineTable({
    toolId: v.id("tools"),
    requesterId: v.id("users"),
    ownerId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    message: v.optional(v.string()),
    status: requestStatusValidator,
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_tool", ["toolId"])
    .index("by_requester", ["requesterId"])
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"])
    .index("by_tool_status", ["toolId", "status"])
    .index("by_owner_status", ["ownerId", "status"]),

  /**
   * An approved request turned into an actual loan. `dueDate` drives the
   * overdue sweep; `status` moves active -> overdue -> returned.
   */
  loans: defineTable({
    toolId: v.id("tools"),
    requestId: v.id("requests"),
    borrowerId: v.id("users"),
    ownerId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    dueDate: v.string(),
    status: loanStatusValidator,
    returnedAt: v.optional(v.number()),
    returnedBy: v.optional(v.id("users")),
    lastReminderAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_tool", ["toolId"])
    .index("by_borrower", ["borrowerId"])
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"])
    .index("by_status_due", ["status", "dueDate"])
    .index("by_request", ["requestId"]),

  /**
   * One row per reminder the automation asked for. `idempotencyKey` is supplied
   * by the caller so a retried n8n run cannot enqueue the same reminder twice.
   */
  reminders: defineTable({
    loanId: v.id("loans"),
    kind: reminderKindValidator,
    status: reminderStatusValidator,
    idempotencyKey: v.string(),
    attempts: v.number(),
    sentAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_loan", ["loanId"])
    .index("by_status", ["status"])
    .index("by_idempotency_key", ["idempotencyKey"]),

  /**
   * The automation audit trail: every outbound n8n trigger and every inbound
   * signed write-back. Inbound rows carry the idempotency key used to reject
   * replays and the loan they refer to, which is what the per-loan activity
   * feed reads. `payload` is a JSON string and must never contain a secret.
   */
  automationEvents: defineTable({
    kind: v.string(),
    direction: automationDirectionValidator,
    workflow: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    loanId: v.optional(v.id("loans")),
    payload: v.optional(v.string()),
    status: automationStatusValidator,
    lastError: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_kind", ["kind"])
    .index("by_direction", ["direction"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_loan_created", ["loanId", "createdAt"]),

  /**
   * Generic replay ledger for inbound automation calls. One row per
   * idempotency key; `result` stores the JSON the first call returned, so a
   * retried n8n run gets the original outcome and performs no second write.
   *
   * Rows can be pruned once older than the retry horizon (n8n retries for
   * hours, not weeks), which keeps the table small.
   */
  automationIdempotency: defineTable({
    key: v.string(),
    kind: v.string(),
    result: v.string(),
    createdAt: v.number(),
  }).index("by_key", ["key"]),
});

export default schema;
