import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

/**
 * The authenticated segment.
 *
 * `auth()` sits next to the data on purpose: the proxy is the optimistic gate,
 * this is the one that must never be skipped. `instant = false` keeps the
 * session read on the server instead of forcing the whole segment behind a
 * Suspense boundary, which is correct for an app whose dashboard is private
 * end to end.
 */
export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
