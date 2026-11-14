const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const dayMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Today as `YYYY-MM-DD` in UTC, the format Convex stores day ranges in. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `2026-11-18` -> `18 Nov 2026`; malformed input is returned untouched. */
export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return dateFormatter.format(date);
}

/** A whole-day range; a one-day range is not repeated. */
export function formatRange(start: string, end: string): string {
  return start === end
    ? formatDate(start)
    : `${formatDate(start)} – ${formatDate(end)}`;
}

/** Short form for a tight row: `18 Nov`. */
export function formatShortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return dayMonthFormatter.format(date);
}

/** Epoch milliseconds -> `18 Nov 2026`. */
export function formatTimestamp(ms: number | null | undefined): string {
  if (!ms) return "—";
  return dateFormatter.format(new Date(ms));
}

/** Whole days from today to `iso`; negative when the date has passed. */
export function daysFromToday(iso: string): number {
  const target = Date.parse(`${iso}T00:00:00Z`);
  const today = Date.parse(`${todayIso()}T00:00:00Z`);
  if (Number.isNaN(target)) return 0;
  return Math.round((target - today) / 86_400_000);
}

/** "Due today", "Due in 3 days", "Overdue by 4 days" (for an open loan). */
export function dueLabel(dueDate: string): string {
  const days = daysFromToday(dueDate);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return "1 day late";
  return `${Math.abs(days)} days late`;
}
