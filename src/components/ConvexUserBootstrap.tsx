"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

/**
 * Mirrors the signed-in Clerk user into Convex. Rendered once in the root
 * layout, so every page gets a `users` row before it queries one.
 *
 * Waits for `useConvexAuth` before calling: the first render can happen while
 * the Clerk token is still being handed to Convex, and `users.store` needs a
 * verified identity. `store` is idempotent; a transient failure is retried on
 * the next mount because the effect re-runs when either side finishes loading.
 */
export function ConvexUserBootstrap() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const store = useMutation(api.users.store);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || isLoading || !isAuthenticated) return;

    let cancelled = false;
    void store({}).catch((error: unknown) => {
      if (cancelled) return;
      // A missing Convex deployment or an unclaimed Clerk app should not take
      // the page down; the UI still renders its signed-out state.
      console.error("Could not mirror the Clerk user into Convex", error);
    });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, isLoading, isAuthenticated, store]);

  return null;
}
