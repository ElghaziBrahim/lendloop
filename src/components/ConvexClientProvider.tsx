"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is missing. Run `npx convex dev` once to write it to .env.local.",
  );
}

// One client per browser tab; created at module scope so React re-renders do
// not open a second websocket.
const convex = new ConvexReactClient(convexUrl);

/**
 * Convex talks to the deployment with the Clerk session token. The
 * `convex` JWT template in Clerk carries `aud: "convex"` and the user's
 * email, which `convex/auth.config.ts` validates.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
