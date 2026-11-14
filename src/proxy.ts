import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk's middleware, now called Proxy in Next.js 16.
 *
 * Two gates, both cheap:
 * - `/dashboard` needs a session. A signed-out visitor is redirected to
 *   sign-in (and back afterwards) before the page renders, so no dashboard
 *   HTML is ever streamed to an anonymous request.
 * - A signed-in visitor on `/` belongs on their dashboard, not the public page.
 *
 * The redirect is written out rather than left to `auth.protect()`: protect()
 * answers a request it does not classify as a page request with a not-found
 * error, so the same URL returned 404 to curl and HEAD and 307 to a browser.
 * One explicit redirect behaves the same for browsers, link previews and
 * monitors, and still carries the `redirect_url` Clerk needs to return the
 * visitor to the page they asked for.
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
    const { userId } = await auth();
    if (!userId) {
      const signIn = new URL("/sign-in", request.url);
      signIn.searchParams.set("redirect_url", request.url);
      return NextResponse.redirect(signIn);
    }
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
