"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { fullName } from "@/lib/utils";
import type { PersonRecord } from "@/components/tree/tree-view";

const RELATIONSHIPS = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "spouse", label: "Spouse" },
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "brother", label: "Brother" },
  { value: "sister", label: "Sister" },
] as const;

interface AddPersonDialogProps {
  people: PersonRecord[];
  onClose: () => void;
  onAdded: (personId: string) => void;
}

export function AddPersonDialog({
  people,
  onClose,
  onAdded,
}: AddPersonDialogProps) {
  const [anchorId, setAnchorId] = useState(people[0]?.id ?? "");
  const [relationship, setRelationship] =
    useState<(typeof RELATIONSHIPS)[number]["value"]>("son");
  const [givenName, setGivenName] = useState("");
  const [surname, setSurname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anchor = people.find((p) => p.id === anchorId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/persons/${anchorId}/relatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationship,
          givenName: givenName || undefined,
          surname: surname || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not add person");
      }
      const created = await res.json();
      onAdded(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add a person"
      onClick={() => !busy && onClose()}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-6 sm:rounded-2xl"
      >
        <h2 className="text-xl font-bold">Add a person</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose who they&apos;re related to — they&apos;ll be placed in the tree
          automatically.
        </p>

        <div className="mt-4">
          <Label htmlFor="anchor">Related to</Label>
          <Select
            id="anchor"
            value={anchorId}
            onChange={(e) => setAnchorId(e.target.value)}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p.givenName, p.surname)}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-4">
          <Label htmlFor="rel">The new person is their…</Label>
          <Select
            id="rel"
            value={relationship}
            onChange={(e) =>
              setRelationship(e.target.value as typeof relationship)
            }
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-4 flex gap-3">
          <div className="flex-1">
            <Label htmlFor="ap-given">First name</Label>
            <Input
              id="ap-given"
              value={givenName}
              autoFocus
              onChange={(e) => setGivenName(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="ap-surname">Last name</Label>
            <Input
              id="ap-surname"
              value={surname}
              placeholder={anchor?.surname ?? ""}
              onChange={(e) => setSurname(e.target.value)}
            />
          </div>
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
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !anchorId}>
            {busy ? "Adding…" : "Add person"}
          </Button>
        </div>
      </form>
    </div>
  );
}
