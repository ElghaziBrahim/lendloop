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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const waiting = card.key === "incoming" && values.incoming > 0;
        return (
          <Link
            key={card.key}
            href={card.href}
            className={
              waiting
                ? "group rounded-md border border-photo-warm bg-sand-200 p-5 transition-colors hover:border-rule-dark"
                : "group rounded-md border border-border bg-card p-5 transition-colors hover:border-rule-dark"
            }
          >
            <p className="font-mono text-[10.5px] leading-4 font-medium tracking-[0.7px] text-muted-foreground uppercase">
              {card.label}
            </p>
            <p className="mt-[14px] font-serif text-[32px] leading-9 font-semibold tracking-[-0.8px] tabular-nums">
              {values[card.key]}
            </p>
            <p className="mt-[6px] text-xs leading-[18px] text-subtle-foreground">
              {card.hint}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
