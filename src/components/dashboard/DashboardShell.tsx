"use client";

import { UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { BrandMark } from "@/components/BrandMark";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
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
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
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
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
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
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center gap-3 px-4 sm:gap-8 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-[9px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <BrandMark className="size-[22px]" />
            <span className="font-serif text-lg font-semibold tracking-[-0.2px]">
              LendLoop
            </span>
          </Link>

          <nav
            aria-label="Dashboard"
            className="ll-scroll flex min-w-0 flex-1 items-center gap-[2px] overflow-x-auto"
          >
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
                    "inline-flex shrink-0 items-center gap-[7px] rounded-[3px] px-3 py-2 text-[13px] whitespace-nowrap transition-colors",
                    active
                      ? "bg-accent font-semibold text-primary dark:text-foreground"
                      : "font-medium text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                  {showCount ? (
                    <span
                      className={cx(
                        "inline-flex size-[18px] items-center justify-center rounded-full font-mono text-[10px] font-semibold",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      {pendingIncoming}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-[10px]">
            <ThemeSwitcher />
            <span className="hidden max-w-[14rem] truncate font-mono text-[10.5px] tracking-[0.8px] text-muted-foreground uppercase sm:block">
              {user.name ?? user.email}
            </span>
            {user.role === "admin" ? <Badge tone="emerald">Admin</Badge> : null}
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center gap-8 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-5 w-24" />
          <div className="flex flex-1 gap-1">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-7 w-20" />
            ))}
          </div>
          <Skeleton className="size-7 rounded-full" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
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
