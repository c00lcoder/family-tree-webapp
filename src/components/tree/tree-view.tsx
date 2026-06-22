"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookText, Download, MapPin, Upload, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FamilyChart } from "@/components/tree/family-chart";
import { PersonEditor } from "@/components/tree/person-editor";
import { AddPersonDialog } from "@/components/tree/add-person-dialog";
import type { FamilyChartDatum } from "@/lib/gedcom/to-family-chart";

export interface PersonRecord {
  id: string;
  givenName: string | null;
  surname: string | null;
  suffix: string | null;
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
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">(
    "vertical",
  );
  const [showSiblings, setShowSiblings] = useState(false);
  const [fitNonce, setFitNonce] = useState(0);

  const peopleList = Object.values(persons);

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
            <Button
              onClick={() =>
                peopleList.length ? setAddOpen(true) : addPerson()
              }
              variant="secondary"
            >
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
        <Link href={`/trees/${treeId}/sources`}>
          <Button variant="secondary">
            <BookText className="h-5 w-5" aria-hidden />
            Sources
          </Button>
        </Link>
        <Link href={`/trees/${treeId}/places`}>
          <Button variant="secondary">
            <MapPin className="h-5 w-5" aria-hidden />
            Places
          </Button>
        </Link>
        <a href={`/api/trees/${treeId}/export`} download>
          <Button variant="secondary">
            <Download className="h-5 w-5" aria-hidden />
            Export GEDCOM
          </Button>
        </a>
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
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setOrientation((o) =>
                  o === "vertical" ? "horizontal" : "vertical",
                )
              }
            >
              {orientation === "vertical" ? "Horizontal" : "Vertical"} layout
            </Button>
            <Button
              size="sm"
              variant={showSiblings ? "primary" : "secondary"}
              aria-pressed={showSiblings}
              onClick={() => setShowSiblings((s) => !s)}
            >
              {showSiblings ? "Hide" : "Show"} siblings
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setFitNonce((n) => n + 1)}
            >
              Recenter
            </Button>
          </div>
          <FamilyChart
            data={graph}
            onSelect={setSelectedId}
            orientation={orientation}
            showSiblings={showSiblings}
            fitNonce={fitNonce}
          />
        </div>
      )}

      {addOpen && (
        <AddPersonDialog
          people={peopleList}
          onClose={() => setAddOpen(false)}
          onAdded={async (id) => {
            setAddOpen(false);
            await load();
            setSelectedId(id);
          }}
        />
      )}

      {selectedId && persons[selectedId] && (
        <PersonEditor
          key={selectedId}
          treeId={treeId}
          person={persons[selectedId]}
          canEdit={canEdit}
          onClose={() => setSelectedId(null)}
          onSaved={async (focusPersonId?: string) => {
            await load();
            if (focusPersonId) setSelectedId(focusPersonId);
          }}
        />
      )}
    </div>
  );
}
