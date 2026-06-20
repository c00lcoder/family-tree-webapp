"use client";

import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { uploadImage } from "@/lib/media";
import type { PersonRecord } from "@/components/tree/tree-view";

interface PersonEditorProps {
  treeId: string;
  person: PersonRecord;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function PersonEditor({
  treeId,
  person,
  canEdit,
  onClose,
  onSaved,
}: PersonEditorProps) {
  const [givenName, setGivenName] = useState(person.givenName ?? "");
  const [surname, setSurname] = useState(person.surname ?? "");
  const [sex, setSex] = useState<PersonRecord["sex"]>(person.sex);
  const [notes, setNotes] = useState(person.notes ?? "");
  const [avatarMediaId, setAvatarMediaId] = useState(person.avatarMediaId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/persons/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          givenName: givenName || null,
          surname: surname || null,
          sex,
          notes: notes || null,
          avatarMediaId,
        }),
      });
      if (!res.ok) throw new Error("Could not save changes");
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this person? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/persons/${person.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not delete");
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { mediaId } = await uploadImage(treeId, file, {
        personId: person.id,
      });
      setAvatarMediaId(mediaId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit person"
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-6 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {canEdit ? "Edit person" : "Person details"}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-6 w-6" aria-hidden />
          </Button>
        </div>

        <fieldset disabled={!canEdit || busy} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="given">First name</Label>
            <Input
              id="given"
              value={givenName}
              onChange={(e) => setGivenName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="surname">Last name</Label>
            <Input
              id="surname"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sex">Sex</Label>
            <Select
              id="sex"
              value={sex}
              onChange={(e) => setSex(e.target.value as PersonRecord["sex"])}
            >
              <option value="U">Unknown</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {canEdit && (
            <div>
              <Label>Photo</Label>
              <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border-2 border-border px-4 font-semibold hover:bg-muted">
                <ImagePlus className="h-5 w-5" aria-hidden />
                {avatarMediaId ? "Change photo" : "Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleAvatar}
                />
              </label>
            </div>
          )}
        </fieldset>

        {error ? (
          <p className="mt-3 text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {canEdit && (
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={busy}
            >
              Delete
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
