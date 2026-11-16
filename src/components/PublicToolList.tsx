import { connection } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { ShelfCard, type PublicTool } from "@/components/landing/ShelfCard";

/**
 * The anonymous shelf.
 *
 * This is a Server Component on purpose: the visitor receives rendered HTML,
 * and the only tool fields that ever leave Convex are `name` and `category`.
 * There is no owner id, email or display name to leak, because the query does
 * not return them in the first place.
 */

async function loadTools(): Promise<PublicTool[] | null> {
  // The list must be fresh on every request, so opt this boundary out of
  // prerendering. Without this, Next.js would try to run the Convex client
  // while building the static shell.
  await connection();

  try {
    return await fetchQuery(api.tools.listPublic, {});
  } catch (error) {
    // A Convex outage should not take the public page down with it.
    console.error("Could not load the public tool list from Convex", error);
    return null;
  }
}

export async function PublicToolList() {
  const tools = await loadTools();

  if (tools === null) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
        <p className="font-serif text-[22px] font-semibold text-foreground">
          The shelf could not be loaded.
        </p>
        <p className="mt-2 text-[16px] leading-[26px] text-muted-foreground">
          Refresh the page to try again.
        </p>
      </div>
    );
  }

  const sorted = [...tools].sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );

  return <ShelfCard tools={sorted} />;
}

/** The static shell's placeholder; also announced to screen readers. */
export function PublicToolListSkeleton() {
  return (
    <div>
      <p className="sr-only">Loading the tool list…</p>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-lg border border-border bg-card"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[452px_minmax(0,1fr)]">
          <div className="border-b border-border p-5 lg:border-r lg:border-b-0 lg:p-[30px]">
            <div className="h-[46px] w-full animate-pulse rounded-[3px] bg-muted" />
            <div className="mt-5 flex gap-2">
              {[0, 1, 2].map((chip) => (
                <div
                  key={chip}
                  className="h-[34px] w-20 animate-pulse rounded-full bg-muted"
                />
              ))}
            </div>
          </div>
          <div className="divide-y divide-border lg:h-[467px]">
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className="flex min-h-[64px] items-center gap-3 px-8 py-[15px]"
              >
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-20 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
