"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Upload, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FamilyChart } from "@/components/tree/family-chart";
import { PersonEditor } from "@/components/tree/person-editor";
import type { FamilyChartDatum } from "@/lib/gedcom/to-family-chart";

export interface PersonRecord {
  id: string;
  givenName: string | null;
  surname: string | null;
  sex: "M" | "F" | "U";
  notes: string | null;
  avatarMediaId: string | null;
}

interface TreeViewProps {
  treeId: string;
  canEdit: boolean;
}

export function TreeView({ treeId, canEdit }: TreeViewProps) {
  const [graph, setGraph] = useState<FamilyChartDatum[]>([]);
  const [persons, setPersons] = useState<Record<string, PersonRecord>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [graphRes, personsRes] = await Promise.all([
      fetch(`/api/trees/${treeId}/graph`),
      fetch(`/api/trees/${treeId}/persons`),
    ]);
    const graphData: FamilyChartDatum[] = graphRes.ok
      ? await graphRes.json()
      : [];
    const personList: PersonRecord[] = personsRes.ok
      ? await personsRes.json()
      : [];
    setGraph(graphData);
    setPersons(Object.fromEntries(personList.map((p) => [p.id, p])));
    setLoading(false);
  }, [treeId]);

  useEffect(() => {
    // Fetch the tree's graph + people on mount / when the tree changes. State
    // updates happen after the awaited fetches, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function addPerson() {
    const res = await fetch(`/api/trees/${treeId}/persons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ givenName: "New", surname: "Person", sex: "U" }),
    });
    if (res.ok) {
      const person: PersonRecord = await res.json();
      await load();
      setSelectedId(person.id);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        {canEdit && (
          <>
            <Button onClick={addPerson} variant="secondary">
              <UserPlus className="h-5 w-5" aria-hidden />
              Add person
            </Button>
            <Link href={`/trees/${treeId}/import`}>
              <Button variant="secondary">
                <Upload className="h-5 w-5" aria-hidden />
                Import GEDCOM
              </Button>
            </Link>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading tree…</p>
      ) : graph.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-lg text-muted-foreground">
            This tree is empty.
          </p>
          {canEdit && (
            <div className="mt-4 flex justify-center gap-3">
              <Button onClick={addPerson}>Add the first person</Button>
              <Link href={`/trees/${treeId}/import`}>
                <Button variant="outline">Import a GEDCOM file</Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <FamilyChart data={graph} onSelect={setSelectedId} />
      )}

      {selectedId && persons[selectedId] && (
        <PersonEditor
          treeId={treeId}
          person={persons[selectedId]}
          canEdit={canEdit}
          onClose={() => setSelectedId(null)}
          onSaved={async () => {
            await load();
          }}
        />
      )}
    </div>
  );
}
