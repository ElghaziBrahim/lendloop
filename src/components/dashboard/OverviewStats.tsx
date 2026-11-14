"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { Skeleton } from "@/components/ui";

/**
 * Four numbers that answer "what needs me today?" without opening a page.
 * Each one is derived from the same card-2 queries the destination uses, so
 * there is no second definition to drift.
 */

const cards = [
  {
    key: "shelf",
    label: "On the shelf",
    href: "/dashboard",
    hint: "Tools the circle is lending",
  },
  {
    key: "mine",
    label: "Your open requests",
    href: "/dashboard/requests",
    hint: "Waiting on a lender",
  },
  {
    key: "incoming",
    label: "Waiting on you",
    href: "/dashboard/incoming",
    hint: "Requests to approve or decline",
  },
  {
    key: "loans",
    label: "Out on loan",
    href: "/dashboard/loans",
    hint: "Not yet marked returned",
  },
] as const;

export function OverviewStats() {
  const shelf = useQuery(api.tools.listShelf);
  const mine = useQuery(api.requests.listMine);
  const incoming = useQuery(api.requests.listIncoming);
  const loans = useQuery(api.loans.listIncoming);

  const loading =
    shelf === undefined ||
    mine === undefined ||
    incoming === undefined ||
    loans === undefined;

  if (loading) {
    return (
      <div>
        <p className="sr-only">Loading your counts…</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((card) => (
            <Skeleton key={card.key} className="h-[104px]" />
          ))}
        </div>
      </div>
    );
  }

  const values: Record<(typeof cards)[number]["key"], number> = {
    shelf: shelf.length,
    mine: mine.filter((request) => request.status === "pending").length,
    incoming: incoming.filter((request) => request.status === "pending").length,
    loans: loans.filter((loan) => loan.status !== "returned").length,
  };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.key}
          href={card.href}
          className="group rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-emerald-600/60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-400/60"
        >
          <p className="text-xs leading-5 font-medium text-zinc-500 dark:text-zinc-400">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
            {values[card.key]}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {card.hint}
          </p>
        </Link>
      ))}
    </div>
  );
}
