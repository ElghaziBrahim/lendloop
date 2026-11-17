import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Daily housekeeping.
 *
 * 00:05 UTC: flip past-due `active` loans to `overdue`, so the stored status
 * the list views read is current before anyone opens the app.
 *
 * 03:15 UTC: prune the automation bookkeeping and close outbound events that
 * were left `pending` by an action that died mid-flight.
 *
 * Both times are UTC on purpose: the app's calendar days are UTC everywhere.
 */
const crons = cronJobs();

crons.daily(
  "mark overdue loans",
  { hourUTC: 0, minuteUTC: 5 },
  internal.loans.markOverdue,
  {},
);

crons.daily(
  "prune automation bookkeeping",
  { hourUTC: 3, minuteUTC: 15 },
  internal.maintenance.pruneAutomation,
  {},
);

export default crons;
