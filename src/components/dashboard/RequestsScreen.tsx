"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Section,
  SkeletonList,
  StatusBadge,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { formatRange, formatTimestamp } from "@/lib/format";
import { useAction } from "@/lib/use-action";

/**
 * Ask for a tool over a date range, then watch the requests you made.
 *
 * The availability note is a reading of the card-2 `tools.availability` query,
 * but the button is never disabled to "enforce" a rule: submitting still calls
 * `requests.create`, and the server re-checks overlap, ownership and
 * duplicates. If two people race for the same dates, the server decides.
 */

type ShelfTool = FunctionReturnType<typeof api.tools.listShelf>[number];
type MyRequest = FunctionReturnType<typeof api.requests.listMine>[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function RequestsScreen() {
  const searchParams = useSearchParams();
  const requestedTool = searchParams.get("tool");

  const shelf = useQuery(api.tools.listShelf);
  const mine = useQuery(api.requests.listMine);
  const create = useMutation(api.requests.create);
  const cancel = useMutation(api.requests.cancel);
  const action = useAction();

  const [touchedTool, setTouchedTool] = useState(false);
  const [toolId, setToolId] = useState<Id<"tools"> | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");
  const [confirmCancel, setConfirmCancel] = useState<Id<"requests"> | null>(
    null,
  );

  const borrowable = (shelf ?? []).filter((tool) => !tool.ownerIsMe);
  const preferred =
    requestedTool && borrowable.some((tool) => tool._id === requestedTool)
      ? (requestedTool as Id<"tools">)
      : "";
  const activeToolId = touchedTool ? toolId : preferred;

  const rangeValid =
    ISO_DATE.test(startDate) &&
    ISO_DATE.test(endDate) &&
    startDate <= endDate;

  const availability = useQuery(
    api.tools.availability,
    activeToolId !== "" && rangeValid
      ? {
          toolId: activeToolId as Id<"tools">,
          startDate,
          endDate,
        }
      : "skip",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeToolId === "") return;

    const sent = await action.run(
      "create-request",
      () =>
        create({
          toolId: activeToolId as Id<"tools">,
          startDate,
          endDate,
          message: message.trim() || undefined,
        }),
      "Request sent. The lender sees it in Incoming.",
    );

    if (sent) {
      setTouchedTool(false);
      setToolId("");
      setStartDate("");
      setEndDate("");
      setMessage("");
    }
  }

  async function handleCancel(requestId: Id<"requests">) {
    const cancelled = await action.run(
      `cancel:${requestId}`,
      () => cancel({ requestId }),
      "Request cancelled.",
    );
    if (cancelled) setConfirmCancel(null);
  }

  const pending = (mine ?? []).filter((request) => request.status === "pending");
  const history = (mine ?? []).filter((request) => request.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Requests"
        title="Asks you have made"
        description="Pick a tool, pick the days you need it, and the owner decides. A range is inclusive on both ends; a pending request never blocks the tool for anyone else."
        actions={
          <Link href="/dashboard" className={buttonClass("secondary")}>
            Browse the shelf
          </Link>
        }
      />

      {action.error ? <Banner tone="error">{action.error}</Banner> : null}
      {action.notice ? <Banner tone="success">{action.notice}</Banner> : null}

      <Section
        title="Ask for dates"
        description="The request goes to the tool's owner. They can approve or decline it."
      >
        {shelf === undefined ? (
          <div className="p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            </div>
          </div>
        ) : borrowable.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="Nothing to borrow yet"
              body="The shelf has no tool from another member. List one of yours, or come back when the circle adds something."
              action={
                <Link
                  href="/dashboard/listings"
                  className={buttonClass("secondary", "sm")}
                >
                  List a tool
                </Link>
              }
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 p-4 sm:p-5">
            <Field label="Tool" htmlFor="request-tool">
              <select
                id="request-tool"
                value={activeToolId}
                onChange={(event) => {
                  setTouchedTool(true);
                  setToolId(event.target.value as Id<"tools"> | "");
                }}
                required
                className={inputClass}
              >
                <option value="">Choose a tool…</option>
                {borrowable.map((tool) => (
                  <option key={tool._id} value={tool._id}>
                    {tool.name} — {tool.category}
                    {tool.ownerName ? ` · ${tool.ownerName}` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date" htmlFor="request-start">
                <Input
                  id="request-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </Field>
              <Field label="End date" htmlFor="request-end">
                <Input
                  id="request-end"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </Field>
            </div>

            {rangeValid && activeToolId !== "" ? (
              <AvailabilityNote
                availability={availability}
                tool={borrowable.find((tool) => tool._id === activeToolId)}
              />
            ) : (
              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Choose a tool and both dates to check availability.
              </p>
            )}

            <Field
              label="Message"
              htmlFor="request-message"
              hint="Optional, up to 500 characters. The owner sees this."
            >
              <textarea
                id="request-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="What do you need it for?"
                className={inputClass}
              />
            </Field>

            <div>
              <Button
                type="submit"
                loading={action.pendingKey === "create-request"}
              >
                {action.pendingKey === "create-request"
                  ? "Sending…"
                  : "Send request"}
              </Button>
            </div>
          </form>
        )}
      </Section>

      <Section
        title="Pending"
        description="Still waiting on the lender."
        actions={
          mine === undefined ? null : (
            <Badge tone={pending.length > 0 ? "amber" : "neutral"}>
              {pending.length} pending
            </Badge>
          )
        }
      >
        {mine === undefined ? (
          <SkeletonList rows={2} label="Loading your requests…" />
        ) : pending.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="No pending requests"
              body="When you ask for a tool it waits here until the owner decides."
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {pending.map((request) => (
              <li key={request._id}>
                <RequestRow
                  request={request}
                  confirming={confirmCancel === request._id}
                  cancelling={action.pendingKey === `cancel:${request._id}`}
                  onAskCancel={() => setConfirmCancel(request._id)}
                  onKeep={() => setConfirmCancel(null)}
                  onCancel={() => void handleCancel(request._id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="History"
        description="Approved, declined and cancelled requests."
        actions={
          mine === undefined ? null : (
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {history.length} {history.length === 1 ? "request" : "requests"}
            </span>
          )
        }
      >
        {mine === undefined ? (
          <SkeletonList rows={2} label="Loading your history…" />
        ) : history.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="Nothing decided yet"
              body="Decided requests stay here so you can see how each ask ended."
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {history.map((request) => (
              <li key={request._id}>
                <RequestRow request={request} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function AvailabilityNote({
  availability,
  tool,
}: {
  availability:
    | { available: boolean; conflicts: Array<{ startDate: string; endDate: string }> }
    | undefined;
  tool: ShelfTool | undefined;
}) {
  if (availability === undefined) {
    return (
      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        Checking availability…
      </p>
    );
  }

  if (availability.available) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
        {tool?.name ?? "This tool"} is free for those dates.
      </p>
    );
  }

  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
      Already booked on{" "}
      {availability.conflicts
        .map((conflict) => formatRange(conflict.startDate, conflict.endDate))
        .join(", ")}
      . You can still send the request; the owner and the server decide.
    </p>
  );
}

function RequestRow({
  request,
  confirming,
  cancelling,
  onAskCancel,
  onKeep,
  onCancel,
}: {
  request: MyRequest;
  confirming?: boolean;
  cancelling?: boolean;
  onAskCancel?: () => void;
  onKeep?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight break-words">
            {request.toolName}
          </h3>
          <StatusBadge status={request.status} />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {request.toolCategory}
          </span>
        </div>
        <p className="mt-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {formatRange(request.startDate, request.endDate)}
        </p>
        {request.message ? (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            “{request.message}”
          </p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Asked {formatTimestamp(request.createdAt)}
          {request.status === "approved"
            ? " · approved, now a loan"
            : request.status === "declined"
              ? " · declined by the lender"
              : request.status === "cancelled"
                ? " · cancelled by you"
                : ""}
        </p>
        {request.status === "approved" ? (
          <Link
            href="/dashboard/loans"
            className="mt-2 inline-block text-xs font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
          >
            See it in Loans
          </Link>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-xs text-zinc-600 dark:text-zinc-300">
              Cancel this request?
            </span>
            <Button
              size="sm"
              variant="danger"
              loading={cancelling}
              onClick={onCancel}
            >
              Cancel it
            </Button>
            <Button size="sm" variant="quiet" onClick={onKeep}>
              Keep
            </Button>
          </>
        ) : request.status === "pending" ? (
          <Button size="sm" variant="secondary" onClick={onAskCancel}>
            Cancel request
          </Button>
        ) : request.decidedAt ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Decided {formatTimestamp(request.decidedAt)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
