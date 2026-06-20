"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

export function CreateTreeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/trees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || undefined }),
      });
      if (!res.ok) throw new Error("Could not create tree");
      const tree = await res.json();
      router.push(`/trees/${tree.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-5 w-5" aria-hidden />
        New tree
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create a new tree"
      onClick={() => !saving && setOpen(false)}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-6 sm:rounded-2xl"
      >
        <h2 className="text-xl font-bold">Create a new tree</h2>
        <div className="mt-4">
          <Label htmlFor="tree-name">Name</Label>
          <Input
            id="tree-name"
            value={name}
            autoFocus
            required
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="The Doe Family"
          />
        </div>
        <div className="mt-4">
          <Label htmlFor="tree-desc">Description (optional)</Label>
          <Textarea
            id="tree-desc"
            value={description}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short note about this tree"
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
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
