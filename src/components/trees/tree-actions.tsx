"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

interface TreeActionsProps {
  treeId: string;
  name: string;
  description: string | null;
  canManage: boolean;
  isOwner: boolean;
}

export function TreeActions({
  treeId,
  name,
  description,
  canManage,
  isOwner,
}: TreeActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(name);
  const [newDescription, setNewDescription] = useState(description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trees/${treeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription || null,
        }),
      });
      if (!res.ok) throw new Error("Could not save");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        `Delete "${name}"? This permanently removes everyone and all data in this tree. This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/trees/${treeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
      router.push("/trees");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Rename tree"
          onClick={() => {
            setNewName(name);
            setNewDescription(description ?? "");
            setEditing(true);
          }}
        >
          <Pencil className="h-5 w-5" aria-hidden />
        </Button>
        {isOwner && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete tree"
            onClick={remove}
            disabled={busy}
          >
            <Trash2 className="h-5 w-5 text-destructive" aria-hidden />
          </Button>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit tree"
          onClick={() => !busy && setEditing(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={save}
            className="w-full max-w-md rounded-t-2xl border border-border bg-card p-6 sm:rounded-2xl"
          >
            <h2 className="text-xl font-bold">Edit tree</h2>
            <div className="mt-4">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={newName}
                autoFocus
                required
                maxLength={120}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="mt-4">
              <Label htmlFor="edit-desc">Description (optional)</Label>
              <Textarea
                id="edit-desc"
                value={newDescription}
                maxLength={2000}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            {error ? (
              <p className="mt-3 text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !newName.trim()}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
