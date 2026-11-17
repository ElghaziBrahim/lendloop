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
 * an approved request blocks its range until the loan is marked returned, and
 * an unreturned loan past its end date blocks every future date. The exact
 * date check happens in the request form against `tools.availability`, so this
 * view only has to say "available", "out until" or "overdue".
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
        <span className="font-mono text-[10.5px] tracking-[0.7px] text-muted-foreground uppercase">
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
          <div className="flex flex-wrap gap-2 border-b border-border px-5 py-[14px]">
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

          <ul className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
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
        "inline-flex h-[34px] items-center gap-[7px] rounded-[17px] border px-[13px] text-[13px] transition-colors",
        active
          ? "border-foreground bg-foreground font-semibold text-background"
          : "border-rule-mid bg-card font-medium text-muted-foreground hover:border-rule-dark hover:text-foreground",
      )}
    >
      {label}
      <span className="font-mono text-[10.5px] tabular-nums opacity-70">
        {count}
      </span>
    </button>
  );
}

function ShelfCard({ tool }: { tool: ShelfTool }) {
  const today = todayIso();

  // Every unreturned approved booking comes back. A booking whose end date
  // has passed is the item still being out; one that covers today is the
  // current loan; one that starts later is the next reservation.
  const overdue = [...tool.bookings]
    .filter((booking) => booking.endDate < today)
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const ongoing = tool.bookings.find(
    (booking) => booking.startDate <= today && booking.endDate >= today,
  );
  const upcoming = [...tool.bookings]
    .filter((booking) => booking.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const availability = overdue
    ? {
        tone: "danger" as const,
        text: `Overdue - out since ${formatDate(overdue.startDate)}`,
      }
    : ongoing
      ? { tone: "amber" as const, text: `Out until ${formatDate(ongoing.endDate)}` }
      : upcoming
        ? {
            tone: "emerald" as const,
            text: `Free now · booked ${formatDate(upcoming.startDate)}`,
          }
        : { tone: "emerald" as const, text: "Available now" };

  const available = availability.tone === "emerald";

  return (
    <li className="flex min-w-0 flex-col rounded-md border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-[10px] font-medium tracking-[0.7px] text-muted-foreground uppercase">
          {tool.category}
        </span>
        {tool.ownerIsMe ? (
          <Badge tone="blue">Your listing</Badge>
        ) : tool.ownerTrusted ? (
          <Badge tone="emerald">Trusted</Badge>
        ) : null}
      </div>

      <h3 className="mt-2 font-serif text-[21px] leading-[26px] font-semibold tracking-[-0.3px] break-words">
        {tool.name}
      </h3>

      <p className="mt-2 flex items-center gap-[6px] text-[11.5px] font-semibold">
        <span
          aria-hidden="true"
          className={
            available
              ? "block size-[6px] rounded-full bg-chart-1"
              : overdue
                ? "block size-[6px] rounded-full bg-chart-3"
                : "block size-[6px] rounded-full bg-chart-2"
          }
        />
        <span
          className={
            available
              ? "text-positive-strong"
              : overdue
                ? "text-danger-strong"
                : "text-warn-strong"
          }
        >
          {availability.text}
        </span>
      </p>

      <p className="mt-[10px] line-clamp-2 text-[12.5px] leading-[19px] text-muted-foreground">
        {tool.description ?? "No description yet."}
      </p>

      <div className="my-[14px] h-px bg-muted" />

      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-[7px] text-xs text-subtle-foreground">
          <span
            aria-hidden="true"
            className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[9px] font-semibold text-primary uppercase dark:text-foreground"
          >
            {(tool.ownerName ?? "LL").slice(0, 2)}
          </span>
          <span className="truncate">
            Lent by {tool.ownerName ?? "a circle member"}
          </span>
        </span>
      </div>

      {tool.ownerIsMe ? (
        <Link
          href="/dashboard/listings"
          className={buttonClass("secondary", "md") + " mt-[14px] w-full"}
        >
          Manage
        </Link>
      ) : (
        <Link
          href={`/dashboard/requests?tool=${tool._id}`}
          className={buttonClass("primary", "md") + " mt-[14px] w-full"}
        >
          Request dates
        </Link>
      )}
    </li>
  );
}

function ShelfSkeleton() {
  return (
    <Section title="On the shelf" description="Loading the circle's tools…">
      <p className="sr-only">Loading the shelf…</p>
      <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="rounded-md border border-border bg-card p-5">
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
