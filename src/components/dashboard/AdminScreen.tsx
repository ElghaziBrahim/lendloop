"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  PageHeader,
  PageSkeleton,
  Section,
  SkeletonList,
  StatusBadge,
  buttonClass,
} from "@/components/ui";
import { dueLabel, formatDate, formatRange, formatTimestamp } from "@/lib/format";
import { useAction } from "@/lib/use-action";

/**
 * The admin surface.
 *
 * The role check here only decides what to render; every query and mutation in
 * `convex/admin.ts` calls `requireAdmin` on its own, so a non-admin who reaches
 * the route sees this notice instead of data, and a crafted call still fails.
 */

export function AdminScreen() {
  const me = useQuery(api.users.current);

  if (me === undefined) {
    return <PageSkeleton label="Checking your role…" />;
  }

  if (me === null || me.role !== "admin") {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin"
          title="Admins only"
          description="This area can remove any listing, read every loan and change who is trusted. It is not available to your account."
        />
        <EmptyState
          title="You do not have the admin role"
          body="Roles live in the database, not in a client claim, so this is enforced by Convex even if you open the URL directly."
          action={
            <Link href="/dashboard" className={buttonClass("secondary", "sm")}>
              Back to the dashboard
            </Link>
          }
        />
      </div>
    );
  }

  return <AdminPanels />;
}

function AdminPanels() {
  const tools = useQuery(api.admin.listTools);
  const loans = useQuery(api.admin.listLoans, {});
  const users = useQuery(api.admin.listUsers);
  const removeTool = useMutation(api.admin.removeTool);
  const setTrustedLender = useMutation(api.admin.setTrustedLender);
  const action = useAction();
  const [confirmRemove, setConfirmRemove] = useState<Id<"tools"> | null>(null);

  const openLoans = (loans ?? []).filter((loan) => loan.status !== "returned");

  async function handleRemove(toolId: Id<"tools">) {
    const removed = await action.run(
      `remove:${toolId}`,
      () => removeTool({ toolId }),
      "Listing removed from the shelf.",
    );
    if (removed) setConfirmRemove(null);
  }

  async function handleTrust(userId: Id<"users">, trusted: boolean) {
    await action.run(
      `trust:${userId}`,
      () => setTrustedLender({ userId, trusted }),
      trusted ? "Marked as a trusted lender." : "Trust mark removed.",
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="The whole board"
        description="Every listing, every loan and every account. These actions skip ownership on purpose; each one still checks your role in the mutation."
        actions={
          loans === undefined ? null : (
            <Badge tone={openLoans.length > 0 ? "amber" : "neutral"}>
              {openLoans.length} loans open
            </Badge>
          )
        }
      />

      {action.error ? <Banner tone="error">{action.error}</Banner> : null}
      {action.notice ? <Banner tone="success">{action.notice}</Banner> : null}

      <Section
        title="All listings"
        description="Removed listings stay here so old loans keep a resolvable tool."
        actions={
          tools === undefined ? null : (
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {tools.length} {tools.length === 1 ? "listing" : "listings"}
            </span>
          )
        }
      >
        {tools === undefined ? (
          <SkeletonList rows={3} label="Loading every listing…" />
        ) : tools.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState title="No listings exist" body="No one has put a tool on the shelf." />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {tools.map((tool) => (
              <li
                key={tool._id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium break-words">
                      {tool.name}
                    </span>
                    <StatusBadge
                      status={tool.status}
                      label={tool.status === "active" ? "Active" : "Removed"}
                    />
                    <Badge>{tool.category}</Badge>
                  </div>
                  <p className="mt-1 text-xs break-all text-zinc-500 dark:text-zinc-400">
                    {tool.ownerName ?? "Unknown owner"} · {tool.ownerEmail} ·
                    listed {formatTimestamp(tool.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {confirmRemove === tool._id ? (
                    <>
                      <span className="text-xs text-zinc-600 dark:text-zinc-300">
                        Remove it?
                      </span>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={action.pendingKey === `remove:${tool._id}`}
                        onClick={() => void handleRemove(tool._id)}
                      >
                        Remove
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => setConfirmRemove(null)}
                      >
                        Keep
                      </Button>
                    </>
                  ) : tool.status === "active" ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setConfirmRemove(tool._id);
                        action.clear();
                      }}
                    >
                      Remove
                    </Button>
                  ) : (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Already removed
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="All loans"
        description="Read-only here: the lender closes a loan from the Loans page."
        actions={
          loans === undefined ? null : (
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {loans.length} {loans.length === 1 ? "loan" : "loans"}
            </span>
          )
        }
      >
        {loans === undefined ? (
          <SkeletonList rows={3} label="Loading every loan…" />
        ) : loans.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState title="No loans yet" body="An approved request creates the first one." />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loans.map((loan) => (
              <li key={loan._id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium break-words">
                    {loan.toolName}
                  </span>
                  <StatusBadge
                    status={loan.overdue ? "overdue" : loan.status}
                    label={
                      loan.status === "returned"
                        ? "Returned"
                        : loan.overdue
                          ? "Overdue"
                          : "Out on loan"
                    }
                  />
                </div>
                <p className="mt-1 text-xs break-all text-zinc-500 dark:text-zinc-400">
                  {loan.borrowerName ?? "Unknown borrower"} ({loan.borrowerEmail})
                  {" ← "}
                  {loan.ownerName ?? "Unknown owner"} ({loan.ownerEmail})
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatRange(loan.startDate, loan.endDate)} · due{" "}
                  {formatDate(loan.dueDate)}
                  {loan.status !== "returned" ? ` · ${dueLabel(loan.dueDate)}` : ""}
                  {loan.returnedAt
                    ? ` · returned ${formatTimestamp(loan.returnedAt)}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Accounts"
        description="Trusted lenders carry a badge on the shelf. Roles are read from the database on every call."
        actions={
          users === undefined ? null : (
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {users.length} {users.length === 1 ? "account" : "accounts"}
            </span>
          )
        }
      >
        {users === undefined ? (
          <SkeletonList rows={3} label="Loading accounts…" />
        ) : users.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState title="No accounts" body="The first sign-in creates a row here." />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {users.map((account) => (
              <li
                key={account._id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium break-words">
                      {account.name ?? "No name"}
                    </span>
                    {account.role === "admin" ? (
                      <Badge tone="blue">Admin</Badge>
                    ) : null}
                    {account.trustedLender ? (
                      <Badge tone="emerald">Trusted lender</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs break-all text-zinc-500 dark:text-zinc-400">
                    {account.email} · joined {formatTimestamp(account.createdAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={account.trustedLender ? "secondary" : "primary"}
                  loading={action.pendingKey === `trust:${account._id}`}
                  onClick={() =>
                    void handleTrust(account._id, !account.trustedLender)
                  }
                >
                  {account.trustedLender ? "Remove trust" : "Mark trusted"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
