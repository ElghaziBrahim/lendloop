"use client";

import { UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { Badge, Button, Skeleton, cx } from "@/components/ui";
import { errorMessage } from "@/lib/convex-error";

/**
 * The signed-in shell: brand, navigation, the account button, and the one gate
 * that makes sure the Clerk user has a Convex row before a page queries as
 * them.
 *
 * The server layout has already refused a session-less visitor. This component
 * only waits for the Convex mirror (`users.store`), which the root layout also
 * starts; the extra call is idempotent and covers the race where a page mounts
 * before the mirror finishes.
 */

const navigation = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/listings", label: "Listings" },
  { href: "/dashboard/requests", label: "Requests" },
  { href: "/dashboard/incoming", label: "Incoming" },
  { href: "/dashboard/loans", label: "Loans" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.current);
  const incoming = useQuery(
    api.requests.listIncoming,
    isAuthenticated && user ? {} : "skip",
  );
  const store = useMutation(api.users.store);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (user !== null || syncError !== null) return;

    let cancelled = false;
    void store({}).catch((error: unknown) => {
      if (!cancelled) setSyncError(errorMessage(error));
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, user, store, syncError]);

  if (authLoading) {
    return <ShellSkeleton />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Connecting your session
        </h1>
        <p className="max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          The data server has not accepted your Clerk token yet. Reload to
          connect again.
        </p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }

  if (user === undefined || (user === null && syncError === null)) {
    return <ShellSkeleton />;
  }

  if (user === null) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Setting up your account
        </h1>
        <p className="max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {syncError}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setSyncError(null);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const pendingIncoming =
    incoming?.filter((request) => request.status === "pending").length ?? 0;

  const items =
    user.role === "admin"
      ? [...navigation, { href: "/dashboard/admin", label: "Admin" }]
      : navigation;

  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-3">
            <Link
              href="/dashboard"
              className="text-base font-semibold tracking-tight"
            >
              Lend
              <span className="text-emerald-700 dark:text-emerald-400">
                Loop
              </span>
            </Link>

            <div className="flex min-w-0 items-center gap-2">
              <span className="hidden max-w-[16rem] truncate text-xs text-zinc-500 sm:block dark:text-zinc-400">
                {user.name ?? user.email}
              </span>
              {user.role === "admin" ? (
                <Badge tone="emerald">Admin</Badge>
              ) : null}
              <UserButton />
            </div>
          </div>

          <nav aria-label="Dashboard" className="flex flex-wrap gap-1 pb-2">
            {items.map((item) => {
              const active = isActive(
                pathname,
                item.href,
                "exact" in item ? item.exact : false,
              );
              const showCount =
                item.href === "/dashboard/incoming" && pendingIncoming > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-emerald-700 text-white dark:bg-emerald-400 dark:text-emerald-950"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                  )}
                >
                  {item.label}
                  {showCount ? (
                    <span
                      className={cx(
                        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs leading-5 font-semibold",
                        active
                          ? "bg-white/20 text-white dark:bg-emerald-950/20 dark:text-emerald-950"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
                      )}
                    >
                      {pendingIncoming}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-zinc-400">
          <p className="truncate">
            Signed in as {user.name ?? user.email}
            {user.trustedLender ? " · Trusted lender" : ""}
          </p>
          <p>LendLoop · Next.js · Clerk · Convex</p>
        </div>
      </footer>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="size-7 rounded-full" />
          </div>
          <div className="flex gap-1 pb-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-7 w-20" />
            ))}
          </div>
        </div>
      </div>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <p className="sr-only">Loading your dashboard…</p>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-64 max-w-full" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      </main>
    </div>
  );
}
