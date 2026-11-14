import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk's middleware, now called Proxy in Next.js 16.
 *
 * Two gates, both cheap:
 * - `/dashboard` needs a session. `auth.protect()` redirects a signed-out
 *   visitor to sign-in (and back afterwards) before the page renders, so no
 *   dashboard HTML is ever streamed to an anonymous request.
 * - A signed-in visitor on `/` belongs on their dashboard, not the public page.
 *
 * The dashboard page repeats the session check next to its data. Clerk's
 * guidance is that the check close to the data is the authoritative one and
 * the proxy is the optimistic one, so neither is dropped.
 */

function isDashboard(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  if (isDashboard(pathname)) {
    await auth.protect();
    return;
  }

  if (pathname === "/" && (await auth()).userId) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
