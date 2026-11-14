"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import {
  Badge,
  EmptyState,
  Section,
  Skeleton,
  buttonClass,
  cx,
} from "@/components/ui";
import { formatDate, todayIso } from "@/lib/format";

/**
 * Every active tool in the circle, with a category filter and enough
 * availability to decide without opening a date picker.
 *
 * "Availability" here is the reservation ledger the server already enforces:
 * an approved request blocks its range until the loan is marked returned. The
 * exact date check happens in the request form against `tools.availability`, so
 * this view only has to say "free now" or "out until".
 */

type ShelfTool = FunctionReturnType<typeof api.tools.listShelf>[number];

export function ShelfBrowser() {
  const tools = useQuery(api.tools.listShelf);
  const [category, setCategory] = useState<string | null>(null);

  if (tools === undefined) {
    return <ShelfSkeleton />;
  }

  const categories = Array.from(new Set(tools.map((tool) => tool.category))).sort(
    (a, b) => a.localeCompare(b),
  );
  const selected =
    category !== null && categories.includes(category) ? category : null;
  const visible = selected
    ? tools.filter((tool) => tool.category === selected)
    : tools;

  return (
    <Section
      title="On the shelf"
      description="Everything the circle is lending right now. Pick a category, then ask for dates."
      actions={
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {visible.length} {visible.length === 1 ? "tool" : "tools"}
        </span>
      }
    >
      {tools.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            title="The shelf is empty"
            body="Nothing is being lent yet. Put the first tool up and the circle can start asking for it."
            action={
              <Link href="/dashboard/listings" className={buttonClass("primary", "sm")}>
                List a tool
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 px-4 py-3 sm:px-5 dark:border-zinc-800">
            <FilterChip
              label="All tools"
              count={tools.length}
              active={selected === null}
              onClick={() => {
                setCategory(null);
              }}
            />
            {categories.map((name) => (
              <FilterChip
                key={name}
                label={name}
                count={tools.filter((tool) => tool.category === name).length}
                active={selected === name}
                onClick={() => {
                  setCategory(name);
                }}
              />
            ))}
          </div>

          <ul className="grid gap-px bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3 dark:bg-zinc-800">
            {visible.map((tool) => (
              <ShelfCard key={tool._id} tool={tool} />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-emerald-700 bg-emerald-700 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
      )}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function ShelfCard({ tool }: { tool: ShelfTool }) {
  const today = todayIso();

  const ongoing = tool.bookings.find(
    (booking) => booking.startDate <= today && booking.endDate >= today,
  );
  const upcoming = [...tool.bookings]
    .filter((booking) => booking.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const availability = ongoing
    ? { tone: "amber" as const, text: `Out until ${formatDate(ongoing.endDate)}` }
    : upcoming
      ? {
          tone: "emerald" as const,
          text: `Free now · booked ${formatDate(upcoming.startDate)}`,
        }
      : { tone: "emerald" as const, text: "Available now" };

  return (
    <li className="flex min-w-0 flex-col bg-white p-4 sm:p-5 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <h3 className="min-w-0 text-sm font-semibold tracking-tight break-words">
          {tool.name}
        </h3>
        <Badge tone={availability.tone}>{availability.text}</Badge>
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {tool.category}
      </p>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {tool.description ?? "No description yet."}
      </p>

      <div className="mt-3 flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="min-w-0 truncate">
          Lent by {tool.ownerName ?? "a circle member"}
        </span>
        {tool.ownerTrusted ? <Badge tone="emerald">Trusted</Badge> : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {tool.ownerIsMe ? "Your listing" : "Dates are inclusive"}
        </span>
        {tool.ownerIsMe ? (
          <Link
            href="/dashboard/listings"
            className={buttonClass("secondary", "sm")}
          >
            Manage
          </Link>
        ) : (
          <Link
            href={`/dashboard/requests?tool=${tool._id}`}
            className={buttonClass("secondary", "sm")}
          >
            Request dates
          </Link>
        )}
      </div>
    </li>
  );
}

function ShelfSkeleton() {
  return (
    <Section title="On the shelf" description="Loading the circle's tools…">
      <p className="sr-only">Loading the shelf…</p>
      <div className="grid gap-px bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3 dark:bg-zinc-800">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="bg-white p-5 dark:bg-zinc-900">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-20" />
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-2/3" />
            <Skeleton className="mt-6 h-7 w-28" />
          </div>
        ))}
      </div>
    </Section>
  );
}
