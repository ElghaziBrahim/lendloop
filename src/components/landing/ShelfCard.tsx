"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRightIcon,
  CloseIcon,
  SearchIcon,
} from "@/components/landing/icons";

/**
 * Band 3 of the reference: the shelf card.
 *
 * The image puts a map and a distance on the left and a photo, a distance and
 * an availability chip in each row. The app has none of that, so the left panel
 * is a real search and a real category filter, and a row is a category tile, the
 * tool's name and its category. Search and filtering happen in the browser over
 * the list the server already streamed; no new fields are requested and nothing
 * here can expose an owner.
 *
 * The chips wrap at every width. They used to sit in one horizontal scroller,
 * which cut the fourth chip in half at 390 and gave no hint that the row moved.
 * On desktop the panel is 41% of the card, so the chips breathe and the count
 * sits on the panel's floor instead of leaving a sage void under it.
 */

export type PublicTool = { name: string; category: string };

export function ShelfCard({ tools }: { tools: PublicTool[] }) {
  const searchId = useId();
  const listRef = useRef<HTMLUListElement | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [scrollCue, setScrollCue] = useState({
    overflowing: false,
    atEnd: false,
    thumbHeight: 0,
    thumbTop: 0,
  });

  const categories = useMemo(
    () =>
      Array.from(new Set(tools.map((tool) => tool.category))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [tools],
  );

  const selected =
    category !== null && categories.includes(category) ? category : null;
  const needle = query.trim().toLocaleLowerCase();

  const visible = tools.filter((tool) => {
    const matchesCategory = selected === null || tool.category === selected;
    const matchesQuery =
      needle === "" ||
      tool.name.toLocaleLowerCase().includes(needle) ||
      tool.category.toLocaleLowerCase().includes(needle);
    return matchesCategory && matchesQuery;
  });

  const hasFilters = needle !== "" || selected !== null;
  const count = `${visible.length} ${visible.length === 1 ? "tool" : "tools"}`;

  /*
   * Chrome's overlay scrollbar is invisible until the pointer is over the list,
   * so the cue is a thumb drawn in the page's colours plus a fade at the list's
   * foot. The thumb is measured against a 12 px inset track, which keeps it
   * clear of the card's rounded top and bottom corners.
   */
  const updateScrollCue = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const track = Math.max(0, list.clientHeight - 24);
    const overflowing = list.scrollHeight > list.clientHeight + 4;
    const thumbHeight = overflowing
      ? Math.max(48, Math.round((track / list.scrollHeight) * track))
      : 0;
    const maxThumbTop = track - thumbHeight;
    const maxScroll = list.scrollHeight - list.clientHeight;
    const thumbTop =
      maxScroll > 0 ? Math.round((list.scrollTop / maxScroll) * maxThumbTop) : 0;
    const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 4;

    setScrollCue({ overflowing, atEnd, thumbHeight, thumbTop });
  }, []);

  useEffect(() => {
    updateScrollCue();
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateScrollCue);
    observer.observe(list);
    return () => {
      observer.disconnect();
    };
  }, [updateScrollCue, visible.length]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-1 lg:grid-cols-[452px_minmax(0,1fr)]">
        <div className="flex flex-col border-b border-border p-5 lg:border-r lg:border-b-0 lg:p-[30px]">
          <label htmlFor={searchId} className="sr-only">
            Search the shelf
          </label>

          <div className="flex gap-3">
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-subtle-foreground" />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder="Search the shelf"
                autoComplete="off"
                className="h-[46px] w-full rounded-[3px] border border-input bg-card pr-4 pl-10 text-sm text-foreground outline-none placeholder:text-subtle-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory(null);
                }}
                aria-label="Clear search and category filters"
                title="Clear filters"
                className="flex size-[46px] shrink-0 items-center justify-center rounded-[3px] border border-input bg-card text-muted-foreground transition-colors hover:border-rule-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            ) : null}
          </div>

          <div className="mt-6">
            <p className="font-mono text-[10px] font-medium tracking-[0.7px] text-muted-foreground uppercase">
              Categories
            </p>
            <div
              role="group"
              aria-label="Filter by category"
              className="mt-3 flex flex-wrap gap-2"
            >
              <FilterChip
                label="All tools"
                active={selected === null}
                onClick={() => {
                  setCategory(null);
                }}
              />
              {categories.map((name) => (
                <FilterChip
                  key={name}
                  label={name}
                  active={selected === name}
                  onClick={() => {
                    setCategory(name);
                  }}
                />
              ))}
            </div>
          </div>

          <p
            role="status"
            aria-live="polite"
            className="mt-auto border-t border-muted pt-[18px] font-mono text-[10.5px] tracking-[0.7px] text-muted-foreground uppercase dark:border-border"
          >
            {count}
          </p>
        </div>

        {visible.length === 0 ? (
          <div className="flex min-h-[180px] flex-col justify-center gap-2 p-6 lg:h-[467px] lg:px-8">
            <p className="font-serif text-[22px] leading-[28px] font-semibold tracking-[-0.3px] text-foreground">
              {tools.length === 0 ? "The shelf is empty" : "No tools match"}
            </p>
            <p className="text-[16px] leading-[26px] text-muted-foreground">
              {tools.length === 0
                ? "Nothing has been listed yet. Sign in and put the first tool on the shelf."
                : "Try another search, or pick a different category."}
            </p>
          </div>
        ) : (
          <div className="relative min-w-0">
            <div className="flex items-center justify-between border-b border-muted px-5 py-[18px] sm:px-8 sm:py-[22px] dark:border-border">
              <span className="font-mono text-[10px] font-medium tracking-[0.7px] text-muted-foreground uppercase">
                Tool
              </span>
              <span className="font-mono text-[10px] font-medium tracking-[0.7px] text-muted-foreground uppercase">
                Category
              </span>
              <span className="sr-only">Action</span>
            </div>
            <ul
              ref={listRef}
              onScroll={updateScrollCue}
              tabIndex={0}
              aria-label="Tools on the shelf"
              className="ll-scroll min-w-0 divide-y divide-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring dark:divide-border"
            >
              {visible.map((tool, index) => (
                <li
                  key={`${tool.name}-${tool.category}-${index}`}
                  className="flex min-h-[64px] items-center gap-4 px-5 py-[15px] sm:px-8"
                >
                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
                    {tool.name}
                  </p>
                  <span className="hidden w-[140px] shrink-0 truncate text-[12.5px] text-muted-foreground sm:block">
                    {tool.category}
                  </span>
                  <Link
                    href="/sign-in"
                    className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    View tool
                    <ArrowRightIcon className="size-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
            {scrollCue.overflowing ? (
              <div
                aria-hidden
                className="pointer-events-none absolute top-3 right-2 bottom-3 hidden w-1.5 lg:block"
              >
                <span
                  className="block w-full rounded-full bg-muted/40 transition-[transform] duration-150"
                  style={{
                    height: scrollCue.thumbHeight,
                    transform: `translateY(${scrollCue.thumbTop}px)`,
                  }}
                />
              </div>
            ) : null}
            {scrollCue.overflowing && !scrollCue.atEnd ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-16 bg-gradient-to-t from-card via-card/80 to-transparent lg:block"
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "inline-flex h-[34px] shrink-0 items-center rounded-full border border-foreground bg-foreground px-[13px] text-[13px] font-semibold whitespace-nowrap text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          : "inline-flex h-[34px] shrink-0 items-center rounded-full border border-rule-mid bg-card px-[13px] text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:border-rule-dark hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      }
    >
      {label}
    </button>
  );
}
