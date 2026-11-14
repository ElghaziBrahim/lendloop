import { connection } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";

/**
 * The anonymous shelf.
 *
 * This is a Server Component on purpose: the visitor receives rendered HTML,
 * and the only tool fields that ever leave Convex are `name` and `category`.
 * There is no owner id, email or display name to leak, because the query does
 * not return them in the first place.
 */

type PublicTool = { name: string; category: string };

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
      <div className="max-w-xl">
        <h2 className="text-2xl font-semibold tracking-tight">On the shelf</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          The shelf could not be loaded just now. Refresh the page to try
          again.
        </p>
      </div>
    );
  }

  const sorted = [...tools].sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">On the shelf</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Names and categories only. Who owns what stays private.
          </p>
        </div>
        {sorted.length > 0 ? (
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {sorted.length} {sorted.length === 1 ? "tool" : "tools"} available
          </p>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-8 max-w-xl rounded-xl border border-dashed border-zinc-300 px-5 py-6 text-sm leading-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Nothing is on the shelf yet. Sign in and put the first tool on it.
        </p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((tool, index) => (
            <li
              key={`${tool.name}-${tool.category}-${index}`}
              className="rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
            >
              <p className="text-base font-medium tracking-tight">
                {tool.name}
              </p>
              <p className="mt-3 inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {tool.category}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The static shell's placeholder; also announced to screen readers. */
export function PublicToolListSkeleton() {
  return (
    <div>
      <p className="sr-only">Loading the tool list…</p>
      <h2 className="text-2xl font-semibold tracking-tight">On the shelf</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Fetching what is available…
      </p>
      <ul
        aria-hidden="true"
        className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <li
            key={index}
            className="h-[104px] animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </ul>
    </div>
  );
}
