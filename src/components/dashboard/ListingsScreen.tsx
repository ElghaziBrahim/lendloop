"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type FormEvent } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Banner,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Section,
  SkeletonList,
  StatusBadge,
  inputClass,
} from "@/components/ui";
import { formatTimestamp } from "@/lib/format";
import { useAction } from "@/lib/use-action";

/**
 * The caller's own listings: create, edit, remove.
 *
 * Every action goes to the card-2 mutation that owns its rule — the form does
 * not pre-authorise anything. A removed listing keeps its row (so old loans
 * still resolve), which is why it stays visible here with the edit and remove
 * actions gone.
 */

type OwnTool = FunctionReturnType<typeof api.tools.listMine>[number];

const SUGGESTED_CATEGORIES = [
  "Power tools",
  "Hand tools",
  "Garden",
  "Camping",
  "Kitchen",
  "Ladders",
  "Electronics",
  "Workshop",
];

export function ListingsScreen() {
  const tools = useQuery(api.tools.listMine);
  const create = useMutation(api.tools.create);
  const update = useMutation(api.tools.update);
  const remove = useMutation(api.tools.remove);
  const action = useAction();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const [editingId, setEditingId] = useState<Id<"tools"> | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: "",
    category: "",
    description: "",
  });
  const [confirmId, setConfirmId] = useState<Id<"tools"> | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await action.run(
      "create",
      () =>
        create({
          name,
          category,
          description: description.trim() || undefined,
        }),
      "Listing created. It is on the shelf now.",
    );
    if (created) {
      setName("");
      setCategory("");
      setDescription("");
      setShowCreate(false);
    }
  }

  function startEdit(tool: OwnTool) {
    setEditingId(tool._id);
    setEditDraft({
      name: tool.name,
      category: tool.category,
      description: tool.description ?? "",
    });
    setConfirmId(null);
    action.clear();
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingId === null) return;

    const saved = await action.run(
      `edit:${editingId}`,
      () =>
        update({
          toolId: editingId,
          name: editDraft.name,
          category: editDraft.category,
          description: editDraft.description,
        }),
      "Listing updated.",
    );
    if (saved) setEditingId(null);
  }

  async function confirmRemove(toolId: Id<"tools">) {
    const removed = await action.run(
      `remove:${toolId}`,
      () => remove({ toolId }),
      "Listing removed. Past requests and loans keep their reference.",
    );
    if (removed) setConfirmId(null);
  }

  const categories = Array.from(
    new Set([...SUGGESTED_CATEGORIES, ...(tools ?? []).map((tool) => tool.category)]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Listings"
        title="Your tools"
        description="What you have put on the shelf, and what you have taken down. Only you can edit or remove a listing; an admin can remove any."
        actions={
          <Button
            variant={showCreate ? "secondary" : "primary"}
            onClick={() => {
              setShowCreate((open) => !open);
              action.clear();
            }}
          >
            {showCreate ? "Close form" : "New listing"}
          </Button>
        }
      />

      {action.error ? <Banner tone="error">{action.error}</Banner> : null}
      {action.notice ? <Banner tone="success">{action.notice}</Banner> : null}

      {showCreate ? (
        <Section
          title="List a tool"
          description="The name and category are required; the note is optional."
        >
          <form onSubmit={handleCreate} className="grid gap-4 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tool name" htmlFor="new-name">
                <Input
                  id="new-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Cordless drill"
                  required
                  maxLength={80}
                />
              </Field>
              <Field
                label="Category"
                htmlFor="new-category"
                hint="Pick an existing one or type a new category."
              >
                <Input
                  id="new-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Power tools"
                  list="listing-categories"
                  required
                  maxLength={40}
                />
              </Field>
            </div>
            <Field label="Description" htmlFor="new-description" hint="Optional, up to 500 characters.">
              <textarea
                id="new-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="18V, two batteries and a full bit set."
                className={inputClass}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={action.pendingKey === "create"}>
                {action.pendingKey === "create" ? "Creating…" : "Create listing"}
              </Button>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  setShowCreate(false);
                  action.clear();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Section>
      ) : null}

      <datalist id="listing-categories">
        {categories.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      <Section
        title="On your shelf"
        description="Active listings are visible to everyone signed in."
        actions={
          tools === undefined ? null : (
            <span className="text-xs font-medium text-subtle-foreground">
              {tools.length} {tools.length === 1 ? "listing" : "listings"}
            </span>
          )
        }
      >
        {tools === undefined ? (
          <SkeletonList rows={3} label="Loading your listings…" />
        ) : tools.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="You have not listed anything yet"
              body="A listing is just a name, a category and an optional note. It appears on the shared shelf as soon as you create it."
              action={
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  Create your first listing
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tools.map((tool) => (
              <li key={tool._id} className="px-4 py-4 sm:px-5">
                {editingId === tool._id ? (
                  <form onSubmit={saveEdit} className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Tool name" htmlFor={`edit-name-${tool._id}`}>
                        <Input
                          id={`edit-name-${tool._id}`}
                          value={editDraft.name}
                          onChange={(event) =>
                            setEditDraft((draft) => ({
                              ...draft,
                              name: event.target.value,
                            }))
                          }
                          required
                          maxLength={80}
                        />
                      </Field>
                      <Field label="Category" htmlFor={`edit-category-${tool._id}`}>
                        <Input
                          id={`edit-category-${tool._id}`}
                          value={editDraft.category}
                          onChange={(event) =>
                            setEditDraft((draft) => ({
                              ...draft,
                              category: event.target.value,
                            }))
                          }
                          list="listing-categories"
                          required
                          maxLength={40}
                        />
                      </Field>
                    </div>
                    <Field
                      label="Description"
                      htmlFor={`edit-description-${tool._id}`}
                      hint="Clear the field to remove the description."
                    >
                      <textarea
                        id={`edit-description-${tool._id}`}
                        value={editDraft.description}
                        onChange={(event) =>
                          setEditDraft((draft) => ({
                            ...draft,
                            description: event.target.value,
                          }))
                        }
                        rows={3}
                        maxLength={500}
                        className={inputClass}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        loading={action.pendingKey === `edit:${tool._id}`}
                      >
                        Save changes
                      </Button>
                      <Button
                        type="button"
                        variant="quiet"
                        onClick={() => {
                          setEditingId(null);
                          action.clear();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold tracking-tight break-words">
                          {tool.name}
                        </h3>
                        <StatusBadge
                          status={tool.status}
                          label={tool.status === "active" ? "Active" : "Removed"}
                        />
                        <Badge>{tool.category}</Badge>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {tool.description ?? "No description."}
                      </p>
                      <p className="mt-2 text-xs text-subtle-foreground">
                        Listed {formatTimestamp(tool.createdAt)}
                        {tool.updatedAt !== tool.createdAt
                          ? ` · updated ${formatTimestamp(tool.updatedAt)}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {confirmId === tool._id ? (
                        <>
                          <span className="text-xs text-muted-foreground">
                            Remove from the shelf?
                          </span>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={action.pendingKey === `remove:${tool._id}`}
                            onClick={() => void confirmRemove(tool._id)}
                          >
                            Remove
                          </Button>
                          <Button
                            size="sm"
                            variant="quiet"
                            onClick={() => setConfirmId(null)}
                          >
                            Keep
                          </Button>
                        </>
                      ) : tool.status === "removed" ? (
                        <span className="text-xs text-subtle-foreground">
                          No actions on a removed listing
                        </span>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => startEdit(tool)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setConfirmId(tool._id);
                              action.clear();
                            }}
                          >
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="text-xs leading-5 text-subtle-foreground">
        Removing keeps the row for past requests and loans, but drops the tool
        from the shelf. A removed listing cannot be edited.
      </p>
    </div>
  );
}
