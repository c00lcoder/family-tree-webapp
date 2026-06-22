"use client";

import { useEffect, useState } from "react";
import { BookText, ImagePlus, ScrollText, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { uploadImage } from "@/lib/media";
import { eventLabel } from "@/lib/gedcom/event-labels";
import type { PersonRecord } from "@/components/tree/tree-view";

interface PersonSource {
  citationId: string;
  eventType: string | null;
  page: string | null;
  title: string | null;
  author: string | null;
  publication: string | null;
  repositoryName: string | null;
}

interface PersonStory {
  id: string;
  title: string | null;
  body: string;
  createdAt: string;
  authorName: string | null;
  authorEmail: string | null;
  canDelete: boolean;
}

interface PersonEditorProps {
  treeId: string;
  person: PersonRecord;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (focusPersonId?: string) => Promise<void> | void;
}

const RELATIONSHIP_OPTIONS = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "spouse", label: "Spouse" },
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "brother", label: "Brother" },
  { value: "sister", label: "Sister" },
] as const;

export function PersonEditor({
  treeId,
  person,
  canEdit,
  onClose,
  onSaved,
}: PersonEditorProps) {
  const [givenName, setGivenName] = useState(person.givenName ?? "");
  const [surname, setSurname] = useState(person.surname ?? "");
  const [suffix, setSuffix] = useState(person.suffix ?? "");
  const [sex, setSex] = useState<PersonRecord["sex"]>(person.sex);
  const [notes, setNotes] = useState(person.notes ?? "");
  const [avatarMediaId, setAvatarMediaId] = useState(person.avatarMediaId);
  const [avatarUrl, setAvatarUrl] = useState(person.avatarUrl);
  const [focusX, setFocusX] = useState(person.avatarFocusX ?? 50);
  const [focusY, setFocusY] = useState(person.avatarFocusY ?? 50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<PersonSource[]>([]);
  const [stories, setStories] = useState<PersonStory[]>([]);
  const [storyTitle, setStoryTitle] = useState("");
  const [storyBody, setStoryBody] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/persons/${person.id}/sources`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PersonSource[]) => {
        if (active) setSources(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [person.id]);

  async function loadStories() {
    const res = await fetch(`/api/persons/${person.id}/stories`);
    if (res.ok) setStories(await res.json());
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/persons/${person.id}/stories`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PersonStory[]) => {
        if (active) setStories(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [person.id]);

  function handleFocusClick(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)));
    setFocusX(clamp(((e.clientX - rect.left) / rect.width) * 100));
    setFocusY(clamp(((e.clientY - rect.top) / rect.height) * 100));
  }

  async function handleAddStory() {
    if (!storyBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/persons/${person.id}/stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: storyTitle || undefined,
          body: storyBody,
        }),
      });
      if (!res.ok) throw new Error("Could not save story");
      setStoryTitle("");
      setStoryBody("");
      await loadStories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteStory(storyId: string) {
    if (!confirm("Delete this story?")) return;
    await fetch(`/api/stories/${storyId}`, { method: "DELETE" });
    await loadStories();
  }

  // Add-relative sub-form state.
  const [relationship, setRelationship] =
    useState<(typeof RELATIONSHIP_OPTIONS)[number]["value"]>("father");
  const [relGiven, setRelGiven] = useState("");
  const [relSurname, setRelSurname] = useState("");

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
          suffix: suffix || null,
          sex,
          notes: notes || null,
          avatarMediaId,
          avatarFocusX: focusX,
          avatarFocusY: focusY,
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
      const { mediaId, publicUrl } = await uploadImage(treeId, file, {
        personId: person.id,
        category: "avatar",
      });
      setAvatarMediaId(mediaId);
      setAvatarUrl(publicUrl);
      setFocusX(50);
      setFocusY(50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemovePhoto() {
    if (!avatarMediaId) return;
    setBusy(true);
    setError(null);
    try {
      // Deletes the object + row; the FK nulls this person's avatar reference.
      await fetch(`/api/media/${avatarMediaId}`, { method: "DELETE" });
      setAvatarMediaId(null);
      setAvatarUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddRelative() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/persons/${person.id}/relatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relationship,
          givenName: relGiven || undefined,
          surname: relSurname || surname || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not add relative");
      }
      const created = await res.json();
      // Reload the tree and jump to editing the newly added person. The parent
      // re-points the editor at the new person (the editor is keyed by id, so it
      // remounts with fresh state) — no onClose() here or we'd lose the focus.
      await onSaved(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="surname">Last name</Label>
              <Input
                id="surname"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
              />
            </div>
            <div className="w-24">
              <Label htmlFor="suffix">Suffix</Label>
              <Input
                id="suffix"
                value={suffix}
                placeholder="Jr"
                maxLength={20}
                onChange={(e) => setSuffix(e.target.value)}
              />
            </div>
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
              <div className="flex flex-wrap gap-2">
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
                {avatarMediaId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRemovePhoto}
                  >
                    Remove photo
                  </Button>
                )}
              </div>
              {avatarUrl && (
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground">
                    Tap the photo to choose what shows on the tree card.
                  </p>
                  <button
                    type="button"
                    onClick={handleFocusClick}
                    className="mt-2 block h-40 w-40 overflow-hidden rounded-lg border-2 border-border"
                    aria-label="Set photo focus point"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{ objectPosition: `${focusX}% ${focusY}%` }}
                    />
                  </button>
                </div>
              )}
            </div>
          )}
        </fieldset>

        {error ? (
          <p className="mt-3 text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {sources.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <BookText className="h-5 w-5 text-primary" aria-hidden />
              Sources ({sources.length})
            </h3>
            <ul className="mt-3 space-y-2">
              {sources.map((s) => (
                <li
                  key={s.citationId}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <p className="font-semibold">
                    {s.title ?? "Untitled source"}
                  </p>
                  {s.repositoryName ? (
                    <p className="text-muted-foreground">{s.repositoryName}</p>
                  ) : null}
                  {s.eventType || s.page ? (
                    <p className="text-muted-foreground">
                      {[s.eventType ? eventLabel(s.eventType) : null, s.page]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <ScrollText className="h-5 w-5 text-primary" aria-hidden />
            Stories ({stories.length})
          </h3>
          <ul className="mt-3 space-y-3">
            {stories.map((s) => (
              <li key={s.id} className="rounded-lg border border-border p-3">
                {s.title ? <p className="font-semibold">{s.title}</p> : null}
                <p className="mt-1 whitespace-pre-wrap text-sm">{s.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    by {s.authorName ?? s.authorEmail ?? "Unknown"}
                  </span>
                  {s.canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteStory(s.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            ))}
            {stories.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                No stories yet.
                {canEdit ? " Share a memory below." : ""}
              </li>
            ) : null}
          </ul>
          {canEdit && (
            <div className="mt-3 space-y-2">
              <Input
                placeholder="Title (optional)"
                value={storyTitle}
                maxLength={200}
                onChange={(e) => setStoryTitle(e.target.value)}
              />
              <Textarea
                placeholder="Share a memory about this person…"
                value={storyBody}
                onChange={(e) => setStoryBody(e.target.value)}
              />
              <Button
                variant="secondary"
                onClick={handleAddStory}
                disabled={busy || !storyBody.trim()}
              >
                Add story
              </Button>
            </div>
          )}
        </div>

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

        {canEdit && (
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <UserPlus className="h-5 w-5 text-primary" aria-hidden />
              Add a relative
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick the relationship and the new person is placed in the tree
              automatically.
            </p>
            <fieldset disabled={busy} className="mt-3 space-y-3">
              <div>
                <Label htmlFor="relationship">Relationship</Label>
                <Select
                  id="relationship"
                  value={relationship}
                  onChange={(e) =>
                    setRelationship(
                      e.target.value as typeof relationship,
                    )
                  }
                >
                  {RELATIONSHIP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label htmlFor="rel-given">First name</Label>
                  <Input
                    id="rel-given"
                    value={relGiven}
                    onChange={(e) => setRelGiven(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="rel-surname">Last name</Label>
                  <Input
                    id="rel-surname"
                    value={relSurname}
                    placeholder={surname}
                    onChange={(e) => setRelSurname(e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={handleAddRelative}
                disabled={busy}
                className="w-full"
              >
                {busy ? "Adding…" : "Add relative"}
              </Button>
            </fieldset>
          </div>
        )}
      </div>
    </div>
  );
}
