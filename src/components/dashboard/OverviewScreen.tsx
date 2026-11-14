"use client";

import Link from "next/link";
import { OverviewStats } from "@/components/dashboard/OverviewStats";
import { ShelfBrowser } from "@/components/dashboard/ShelfBrowser";
import { PageHeader, buttonClass } from "@/components/ui";

export function OverviewScreen() {
  return (
    <div className="space-y-8 sm:space-y-10">
      <PageHeader
        eyebrow="Dashboard"
        title="Your lending desk"
        description="Everything you lend and borrow, in one place. The shelf is shared; your requests and loans stay between you and the other side of the exchange."
        actions={
          <>
            <Link
              href="/dashboard/listings"
              className={buttonClass("secondary")}
            >
              List a tool
            </Link>
            <Link
              href="/dashboard/requests"
              className={buttonClass("primary")}
            >
              Ask for dates
            </Link>
          </>
        }
      />

      <OverviewStats />
      <ShelfBrowser />
    </div>
  );
}
