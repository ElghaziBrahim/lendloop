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
      <p className="text-xs font-semibold tracking-[0.2em] text-red-700 uppercase dark:text-red-400">
        Something went wrong
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        This page could not load
      </h1>
      <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
        {errorMessage(error)}
      </p>
      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Nothing was changed. Try again, and if it keeps failing check that the
        Convex deployment is running.
      </p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
