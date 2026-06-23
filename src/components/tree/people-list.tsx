"use client";

import { useState } from "react";
import { Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fullName } from "@/lib/utils";
import type { PersonRecord } from "@/components/tree/tree-view";

/**
 * Searchable list of everyone in the tree. family-chart only draws the main
 * person's ancestors/descendants, so this lets you jump the chart to anyone —
 * including relatives who are off-screen in the current view.
 */
export function PeopleList({
  people,
  onPick,
}: {
  people: PersonRecord[];
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const filtered = people
    .filter((p) => {
      const names = [
        p.givenName,
        p.surname,
        ...(p.marriedSurnames ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return !query || names.includes(query);
    })
    .sort(
      (a, b) =>
        (a.surname ?? "").localeCompare(b.surname ?? "") ||
        (a.givenName ?? "").localeCompare(b.givenName ?? ""),
    );

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Users className="h-5 w-5" aria-hidden />
        People ({people.length})
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="People in this tree"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">People ({people.length})</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="h-6 w-6" aria-hidden />
              </Button>
            </div>
            <Input
              className="mt-3"
              placeholder="Search by name…"
              value={q}
              autoFocus
              onChange={(e) => setQ(e.target.value)}
            />
            <ul className="mt-3 flex-1 overflow-y-auto">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-base hover:bg-muted"
                    onClick={() => {
                      onPick(p.id);
                      setOpen(false);
                    }}
                  >
                    {fullName(p.givenName, p.surname)}
                    {p.marriedSurnames?.length ? (
                      <span className="text-muted-foreground">
                        {" "}
                        ({p.marriedSurnames.join(" / ")})
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-muted-foreground">No matches</li>
              ) : null}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
