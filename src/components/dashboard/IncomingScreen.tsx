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
import { formatRange, formatTimestamp } from "@/lib/format";
import { useAction } from "@/lib/use-action";

/**
 * The owner's inbox: requests for tools they lend, with the two decisions.
 *
 * Approving is not a client-side checkbox. `requests.approve` re-checks that the
 * request is still pending and that no other approval already covers the dates,
 * then creates the loan. A conflict is shown as the server's sentence rather
 * than being prevented by a disabled button.
 */

type IncomingRequest = FunctionReturnType<
  typeof api.requests.listIncoming
>[number];

export function IncomingScreen() {
  const incoming = useQuery(api.requests.listIncoming);
  const approve = useMutation(api.requests.approve);
  const decline = useMutation(api.requests.decline);
  const action = useAction();
  const [confirmDecline, setConfirmDecline] = useState<Id<"requests"> | null>(
    null,
  );

  async function handleApprove(request: IncomingRequest) {
    await action.run(
      `approve:${request._id}`,
      () => approve({ requestId: request._id }),
      `Approved. ${request.toolName} is now on loan for ${formatRange(
        request.startDate,
        request.endDate,
      )}.`,
    );
  }

  async function handleDecline(requestId: Id<"requests">) {
    const declined = await action.run(
      `decline:${requestId}`,
      () => decline({ requestId }),
      "Declined. The borrower can see the decision on their request.",
    );
    if (declined) setConfirmDecline(null);
  }

  const pending = (incoming ?? []).filter(
    (request) => request.status === "pending",
  );
  const decided = (incoming ?? []).filter(
    (request) => request.status !== "pending",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Incoming"
        title="Requests for your tools"
        description="Every ask for something you lend. Approving blocks the dates and opens a loan; declining leaves the tool free."
        actions={
          incoming === undefined ? null : (
            <Badge tone={pending.length > 0 ? "amber" : "neutral"}>
              {pending.length} waiting
            </Badge>
          )
        }
      />

      {action.error ? <Banner tone="error">{action.error}</Banner> : null}
      {action.notice ? <Banner tone="success">{action.notice}</Banner> : null}

      <Section
        title="Waiting on you"
        description="These rows have not been decided yet."
      >
        {incoming === undefined ? (
          <SkeletonList rows={2} label="Loading incoming requests…" />
        ) : pending.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="No one is waiting on you"
              body="When someone asks to borrow one of your tools, it appears here with the dates and their message."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((request) => (
              <li key={request._id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold tracking-tight break-words">
                        {request.toolName}
                      </h3>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {request.requesterName ?? "A circle member"}
                      </span>{" "}
                      <span className="break-all">
                        ({request.requesterEmail})
                      </span>{" "}
                      asked for {formatRange(request.startDate, request.endDate)}.
                    </p>
                    {request.message ? (
                      <p className="mt-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm leading-6 break-words text-foreground">
                        “{request.message}”
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-subtle-foreground">
                      Asked {formatTimestamp(request.createdAt)} ·{" "}
                      {request.toolCategory}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {confirmDecline === request._id ? (
                      <>
                        <span className="text-xs text-muted-foreground">
                          Decline this ask?
                        </span>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={action.pendingKey === `decline:${request._id}`}
                          onClick={() => void handleDecline(request._id)}
                        >
                          Decline it
                        </Button>
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() => setConfirmDecline(null)}
                        >
                          Keep
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          loading={action.pendingKey === `approve:${request._id}`}
                          onClick={() => void handleApprove(request)}
                        >
                          {action.pendingKey === `approve:${request._id}`
                            ? "Approving…"
                            : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setConfirmDecline(request._id);
                            action.clear();
                          }}
                        >
                          Decline
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Decided"
        description="What you have already approved or declined."
        actions={
          incoming === undefined ? null : (
            <span className="text-xs font-medium text-subtle-foreground">
              {decided.length} {decided.length === 1 ? "request" : "requests"}
            </span>
          )
        }
      >
        {incoming === undefined ? (
          <SkeletonList rows={2} label="Loading decisions…" />
        ) : decided.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="No decisions yet"
              body="Approved and declined requests stay here for reference."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {decided.map((request) => (
              <li
                key={request._id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium break-words">
                      {request.toolName}
                    </span>
                    <StatusBadge status={request.status} />
                  </div>
                  <p className="mt-1 text-xs text-subtle-foreground">
                    {request.requesterName ?? "A circle member"} ·{" "}
                    {formatRange(request.startDate, request.endDate)}
                    {request.decidedAt
                      ? ` · decided ${formatTimestamp(request.decidedAt)}`
                      : ""}
                  </p>
                </div>
                <span className="text-xs text-subtle-foreground">
                  {request.status === "approved"
                    ? "Loan created"
                    : "No loan created"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
