"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  PageHeader,
  Section,
  SkeletonList,
  StatusBadge,
} from "@/components/ui";
import {
  dueLabel,
  formatDate,
  formatRange,
  formatTimestamp,
} from "@/lib/format";
import { useAction } from "@/lib/use-action";

/**
 * Loans in both directions.
 *
 * "Lent out" is the owner's side and the only place a return can be confirmed:
 * `loans.markReturned` authorises the lender (or an admin), never the borrower.
 * "Borrowed" is read-only by design — the person holding the item cannot close
 * the loop on their own say-so.
 */

type LentLoan = FunctionReturnType<typeof api.loans.listIncoming>[number];
type BorrowedLoan = FunctionReturnType<typeof api.loans.listMine>[number];

export function LoansScreen() {
  const lent = useQuery(api.loans.listIncoming);
  const borrowed = useQuery(api.loans.listMine);
  const markReturned = useMutation(api.loans.markReturned);
  const action = useAction();
  const [confirmReturn, setConfirmReturn] = useState<Id<"loans"> | null>(null);

  async function handleReturn(loan: LentLoan) {
    const returned = await action.run(
      `return:${loan._id}`,
      () => markReturned({ loanId: loan._id }),
      `${loan.toolName} marked returned. The dates are free again.`,
    );
    if (returned) setConfirmReturn(null);
  }

  const openLent = (lent ?? []).filter((loan) => loan.status !== "returned");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Loans"
        title="What is out"
        description="The lender confirms a return; the borrower cannot close it alone. An overdue loan stays visible until it is marked returned."
        actions={
          lent === undefined ? null : (
            <Badge tone={openLent.length > 0 ? "amber" : "neutral"}>
              {openLent.length} out now
            </Badge>
          )
        }
      />

      {action.error ? <Banner tone="error">{action.error}</Banner> : null}
      {action.notice ? <Banner tone="success">{action.notice}</Banner> : null}

      <Section
        title="Lent out"
        description="Your tools that someone else has."
      >
        {lent === undefined ? (
          <SkeletonList rows={2} label="Loading loans…" />
        ) : lent.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="Nothing of yours is out"
              body="An approved request becomes a loan here, with the due date and a way to mark it returned."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {lent.map((loan) => (
              <li key={loan._id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold tracking-tight break-words">
                        {loan.toolName}
                      </h3>
                      <LoanStatus loan={loan} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {loan.borrowerName ?? "A circle member"}
                      </span>{" "}
                      <span className="break-all">({loan.borrowerEmail})</span>
                    </p>
                    <p className="mt-1 text-xs text-subtle-foreground">
                      {formatRange(loan.startDate, loan.endDate)} · due{" "}
                      {formatDate(loan.dueDate)}
                      {loan.status !== "returned" ? ` · ${dueLabel(loan.dueDate)}` : ""}
                    </p>
                    {loan.returnedAt ? (
                      <p className="mt-1 text-xs text-subtle-foreground">
                        Returned {formatTimestamp(loan.returnedAt)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {loan.status === "returned" ? (
                      <span className="text-xs text-subtle-foreground">
                        Closed
                      </span>
                    ) : confirmReturn === loan._id ? (
                      <>
                        <span className="text-xs text-muted-foreground">
                          Is it back?
                        </span>
                        <Button
                          size="sm"
                          loading={action.pendingKey === `return:${loan._id}`}
                          onClick={() => void handleReturn(loan)}
                        >
                          Mark returned
                        </Button>
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() => setConfirmReturn(null)}
                        >
                          Not yet
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setConfirmReturn(loan._id);
                          action.clear();
                        }}
                      >
                        Mark returned
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Borrowed by you"
        description="Only the lender can confirm these are back."
        actions={
          borrowed === undefined ? null : (
            <span className="text-xs font-medium text-subtle-foreground">
              {borrowed.length} {borrowed.length === 1 ? "loan" : "loans"}
            </span>
          )
        }
      >
        {borrowed === undefined ? (
          <SkeletonList rows={2} label="Loading your loans…" />
        ) : borrowed.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="You have nothing out"
              body="Once a lender approves one of your requests, the loan and its due date appear here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {borrowed.map((loan) => (
              <li
                key={loan._id}
                className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tracking-tight break-words">
                      {loan.toolName}
                    </span>
                    <LoanStatus loan={loan} />
                  </div>
                  <p className="mt-1 text-xs text-subtle-foreground">
                    {formatRange(loan.startDate, loan.endDate)} · due{" "}
                    {formatDate(loan.dueDate)}
                    {loan.status !== "returned" ? ` · ${dueLabel(loan.dueDate)}` : ""}
                  </p>
                  {loan.returnedAt ? (
                    <p className="mt-1 text-xs text-subtle-foreground">
                      Returned {formatTimestamp(loan.returnedAt)}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-subtle-foreground">
                  {loan.status === "returned"
                    ? "The lender closed it"
                    : "Waiting for the lender"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function LoanStatus({ loan }: { loan: LentLoan | BorrowedLoan }) {
  if (loan.status === "returned") {
    return <StatusBadge status="returned" label="Returned" />;
  }
  if (loan.overdue) {
    return <StatusBadge status="overdue" label="Overdue" />;
  }
  return <StatusBadge status="active" label="Out on loan" />;
}
