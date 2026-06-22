"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImportResult {
  persons: number;
  families: number;
  children: number;
  events: number;
  sources: number;
  citations: number;
}

export function ImportForm({ treeId }: { treeId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/trees/${treeId}/import`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Import failed");
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-5">
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card p-6 text-center hover:border-primary">
        <FileUp className="h-8 w-8 text-primary" aria-hidden />
        <span className="font-semibold">
          {file ? file.name : "Choose a GEDCOM (.ged) file"}
        </span>
        <span className="text-sm text-muted-foreground">
          From Ancestry, FamilySearch, Gramps and more (max 20 MB)
        </span>
        <input
          type="file"
          accept=".ged,.gedcom,text/plain"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div
          className="rounded-lg border border-border bg-muted p-4"
          role="status"
        >
          <p className="font-semibold">Import complete</p>
          <ul className="mt-1 text-muted-foreground">
            <li>{result.persons} people</li>
            <li>{result.families} families</li>
            <li>{result.children} parent-child links</li>
            <li>{result.events} events</li>
            <li>{result.sources} sources</li>
            <li>{result.citations} source citations</li>
          </ul>
          <Button
            type="button"
            className="mt-3"
            onClick={() => router.push(`/trees/${treeId}`)}
          >
            View tree
          </Button>
        </div>
      ) : (
        <Button type="submit" disabled={!file || busy}>
          {busy ? "Importing…" : "Import"}
        </Button>
      )}
    </form>
  );
}
