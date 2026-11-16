"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { errorMessage } from "@/lib/convex-error";

/**
 * The error state for every authenticated page.
 *
 * A Convex query that throws (a revoked permission, a deployment that is down)
 * lands here; the message is the server's own sentence, and `reset` retries the
 * segment without a full reload.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard segment failed", error);
  }, [error]);

  return (
    <div className="max-w-xl">
      <p className="font-mono text-[11px] font-medium tracking-[1.5px] text-destructive uppercase">
        Something went wrong
      </p>
      <h1 className="mt-[14px] font-serif text-[30px] leading-[34px] font-semibold tracking-[-0.8px] sm:text-[38px] sm:leading-[42px]">
        This page could not load
      </h1>
      <p className="mt-3 rounded-lg border border-danger-tint-strong bg-danger-tint px-3 py-2 text-sm leading-6 text-danger-strong">
        {errorMessage(error)}
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Nothing was changed. Try again, and if it keeps failing check that the
        Convex deployment is running.
      </p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
