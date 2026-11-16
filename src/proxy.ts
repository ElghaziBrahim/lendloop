import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

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

const HOST = /^(?:\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i;
const PROTOCOL = /^https?$/;

/** The first value of a comma-separated proxy header, trimmed. */
function firstValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

/**
 * The origin the visitor actually used.
 *
 * `request.url` carries the address `next start` listens on, not the address
 * in the browser: behind cloudflared with `--hostname ::` it resolves to
 * `https://[::]:3000`. A redirect built from that origin sends Clerk back to
 * an address the visitor cannot reach, so the origin comes from the proxy
 * headers instead, with `Host` for a proxy that sets no forwarded host and
 * the request's own origin as the last resort. Both values are checked
 * against the forms this app serves before they reach a header.
 */
export function requestBase(
  request: Pick<NextRequest, "headers" | "url">,
): URL {
  const requestUrl = new URL(request.url);
  const host =
    firstValue(request.headers.get("x-forwarded-host")) ||
    firstValue(request.headers.get("host")) ||
    requestUrl.host;
  const protocol =
    firstValue(request.headers.get("x-forwarded-proto")) ||
    requestUrl.protocol.replace(":", "");

  return new URL(
    `${PROTOCOL.test(protocol) ? protocol : requestUrl.protocol.replace(":", "")}://${HOST.test(host) ? host : requestUrl.host}`,
  );
}

/** `/sign-in?redirect_url=…`, returning the visitor to the page they asked for. */
export function signInRedirect(request: NextRequest) {
  const base = requestBase(request);
  const signIn = new URL("/sign-in", base);
  const returnTo = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    base,
  );
  signIn.searchParams.set("redirect_url", returnTo.toString());
  return NextResponse.redirect(signIn);
}

function isDashboard(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  if (isDashboard(pathname)) {
    const { userId } = await auth();
    if (!userId) {
      return signInRedirect(request);
    }
    return;
  }

  if (pathname === "/" && (await auth()).userId) {
    return NextResponse.redirect(new URL("/dashboard", requestBase(request)));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
