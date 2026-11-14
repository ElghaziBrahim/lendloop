import { ConvexError } from "convex/values";

/**
 * Calendar-date helpers.
 *
 * A loan is taken for a range of whole days, stored as ISO `YYYY-MM-DD`
 * strings. Lexicographic comparison of that format is chronological, which is
 * why overlap and past-due checks compare the strings directly instead of
 * parsing them into timestamps.
 *
 * Ranges are inclusive on both ends: `2026-03-10` to `2026-03-12` covers three
 * days, so the next free start is `2026-03-13`.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** True only for a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/** Today's date in UTC as `YYYY-MM-DD`. */
export function todayIso(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Validate a requested day range. Throws `INVALID_DATE_RANGE` with a message
 * the UI can show, so the client never has to duplicate the rule.
 */
export function assertDateRange(startDate: string, endDate: string): void {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw new ConvexError({
      code: "INVALID_DATE_RANGE",
      message: "Choose a start and end date as YYYY-MM-DD.",
    });
  }
  if (startDate > endDate) {
    throw new ConvexError({
      code: "INVALID_DATE_RANGE",
      message: "The end date cannot be before the start date.",
    });
  }
}

/** Inclusive overlap: the two ranges share at least one calendar day. */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Whole days from `fromIso` to `toIso`; negative when `toIso` is earlier. */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / MS_PER_DAY);
}

/** True when `dueDate` is strictly before `asOf` (due today is not overdue). */
export function isPastDue(dueDate: string, asOf: string = todayIso()): boolean {
  return dueDate < asOf;
}
