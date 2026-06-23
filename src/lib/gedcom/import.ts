import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  persons as personsTable,
  families as familiesTable,
  familyChildren as familyChildrenTable,
  events as eventsTable,
  sources as sourcesTable,
  citations as citationsTable,
} from "@/lib/db/schema";
import { parseGedcom } from "./parse";
import type { GedcomEvent, GedcomIndividual } from "./types";

export interface ImportResult {
  persons: number;
  mergedPeople: number;
  families: number;
  children: number;
  events: number;
  sources: number;
  citations: number;
}

const BATCH_SIZE = 500;

async function batchInsert<T>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    if (chunk.length === 0) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(chunk as any);
  }
}

function eventRows(
  treeId: string,
  subject: "person" | "family",
  ownerId: string,
  events: GedcomEvent[],
) {
  return events.map((e) => ({
    treeId,
    subject,
    ...(subject === "person" ? { personId: ownerId } : { familyId: ownerId }),
    type: e.type,
    dateRaw: e.date ?? null,
    place: e.place ?? null,
  }));
}

function yearOf(dateRaw?: string | null): number | null {
  if (!dateRaw) return null;
  const m = dateRaw.match(/\b(\d{4})\b/);
  return m ? Number(m[1]) : null;
}

function birthYear(events: GedcomEvent[]): number | null {
  return yearOf(events.find((e) => e.type === "BIRT")?.date);
}

/**
 * A conservative identity key: only set when given name, surname AND a birth
 * year are all present, so we never merge two different people who happen to
 * share a name. Returns null when we can't be confident (then the person is
 * always inserted).
 */
function personKey(
  given: string | null | undefined,
  surname: string | null | undefined,
  year: number | null,
): string | null {
  const g = (given ?? "").trim().toLowerCase();
  const s = (surname ?? "").trim().toLowerCase();
  if (!g || !s || year == null) return null;
  return `${g}|${s}|${year}`;
}

function familyKey(p1: string | null, p2: string | null): string | null {
  if (!p1 && !p2) return null;
  return [p1 ?? "", p2 ?? ""].sort().join("|");
}

/**
 * Parse a GEDCOM document and persist it into the tree. Importing into a tree
 * that already has data MERGES rather than blindly appends: people are matched
 * by name + birth year, families by their partners. Matched records are reused
 * (their existing events/citations are kept) so re-importing the same file, or
 * combining overlapping files, does not create duplicates.
 */
export async function importGedcom(
  treeId: string,
  input: string | Uint8Array,
): Promise<ImportResult> {
  const { individuals, families, sources } = parseGedcom(input);

  // ----- Build the existing-person index (name + birth year -> id). ---------
  const existingPersons = await db
    .select({
      id: personsTable.id,
      givenName: personsTable.givenName,
      surname: personsTable.surname,
    })
    .from(personsTable)
    .where(eq(personsTable.treeId, treeId));
  const existingBirths = await db
    .select({ personId: eventsTable.personId, dateRaw: eventsTable.dateRaw })
    .from(eventsTable)
    .where(and(eq(eventsTable.treeId, treeId), eq(eventsTable.type, "BIRT")));
  const yearByPerson = new Map<string, number | null>();
  for (const b of existingBirths) {
    if (b.personId && !yearByPerson.has(b.personId)) {
      yearByPerson.set(b.personId, yearOf(b.dateRaw));
    }
  }
  const personByKey = new Map<string, string>();
  for (const p of existingPersons) {
    const key = personKey(p.givenName, p.surname, yearByPerson.get(p.id) ?? null);
    if (key && !personByKey.has(key)) personByKey.set(key, p.id);
  }

  // ----- Persons: reuse matches, insert the rest. ---------------------------
  const xrefToPersonId = new Map<string, string>();
  const newIndividuals: GedcomIndividual[] = [];
  let merged = 0;
  for (const indi of individuals) {
    const key = personKey(indi.givenName, indi.surname, birthYear(indi.events));
    const existingId = key ? personByKey.get(key) : undefined;
    if (existingId) {
      xrefToPersonId.set(indi.xref, existingId);
      merged += 1;
    } else {
      newIndividuals.push(indi);
    }
  }

  let insertedPersons = 0;
  for (let i = 0; i < newIndividuals.length; i += BATCH_SIZE) {
    const chunk = newIndividuals.slice(i, i + BATCH_SIZE).map((indi) => ({
      treeId,
      gedcomXref: indi.xref,
      givenName: indi.givenName ?? null,
      surname: indi.surname ?? null,
      marriedSurnames: indi.marriedSurnames ?? null,
      suffix: indi.suffix ?? null,
      sex: indi.sex,
      notes: indi.notes ?? null,
    }));
    const inserted = await db
      .insert(personsTable)
      .values(chunk)
      .returning({ id: personsTable.id, xref: personsTable.gedcomXref });
    for (const row of inserted) {
      if (row.xref) xrefToPersonId.set(row.xref, row.id);
    }
    insertedPersons += inserted.length;
  }
  // Register newly-inserted keys so within-file duplicates also dedupe.
  for (const indi of newIndividuals) {
    const key = personKey(indi.givenName, indi.surname, birthYear(indi.events));
    const id = xrefToPersonId.get(indi.xref);
    if (key && id && !personByKey.has(key)) personByKey.set(key, id);
  }
  const newPersonXrefs = new Set(newIndividuals.map((i) => i.xref));

  // ----- Families: reuse matches by partners, insert the rest. --------------
  const existingFamilies = await db
    .select({
      id: familiesTable.id,
      partner1Id: familiesTable.partner1Id,
      partner2Id: familiesTable.partner2Id,
    })
    .from(familiesTable)
    .where(eq(familiesTable.treeId, treeId));
  const familyByKey = new Map<string, string>();
  for (const f of existingFamilies) {
    const key = familyKey(f.partner1Id, f.partner2Id);
    if (key && !familyByKey.has(key)) familyByKey.set(key, f.id);
  }

  const xrefToFamilyId = new Map<string, string>();
  const newFamilyXrefs = new Set<string>();
  const familiesToInsert: { xref: string; partner1Id: string | null; partner2Id: string | null }[] = [];
  for (const fam of families) {
    const p1 = fam.husbandXref ? (xrefToPersonId.get(fam.husbandXref) ?? null) : null;
    const p2 = fam.wifeXref ? (xrefToPersonId.get(fam.wifeXref) ?? null) : null;
    const key = familyKey(p1, p2);
    const existingId = key ? familyByKey.get(key) : undefined;
    if (existingId) {
      xrefToFamilyId.set(fam.xref, existingId);
    } else {
      familiesToInsert.push({ xref: fam.xref, partner1Id: p1, partner2Id: p2 });
      newFamilyXrefs.add(fam.xref);
    }
  }
  for (let i = 0; i < familiesToInsert.length; i += BATCH_SIZE) {
    const chunk = familiesToInsert.slice(i, i + BATCH_SIZE).map((f) => ({
      treeId,
      gedcomXref: f.xref,
      partner1Id: f.partner1Id,
      partner2Id: f.partner2Id,
    }));
    const inserted = await db
      .insert(familiesTable)
      .values(chunk)
      .returning({ id: familiesTable.id, xref: familiesTable.gedcomXref });
    for (const row of inserted) {
      if (row.xref) xrefToFamilyId.set(row.xref, row.id);
    }
  }

  // ----- Child links: only for newly-inserted families. ---------------------
  const childRows: { familyId: string; childId: string }[] = [];
  for (const fam of families) {
    if (!newFamilyXrefs.has(fam.xref)) continue;
    const familyId = xrefToFamilyId.get(fam.xref);
    if (!familyId) continue;
    for (const childXref of fam.childXrefs) {
      const childId = xrefToPersonId.get(childXref);
      if (childId) childRows.push({ familyId, childId });
    }
  }
  await batchInsert(familyChildrenTable, childRows);

  // ----- Events: only for newly-inserted persons / families. ----------------
  const eventInsertRows: ReturnType<typeof eventRows> = [];
  for (const indi of individuals) {
    if (!newPersonXrefs.has(indi.xref)) continue;
    const personId = xrefToPersonId.get(indi.xref);
    if (personId)
      eventInsertRows.push(...eventRows(treeId, "person", personId, indi.events));
  }
  for (const fam of families) {
    if (!newFamilyXrefs.has(fam.xref)) continue;
    const familyId = xrefToFamilyId.get(fam.xref);
    if (familyId)
      eventInsertRows.push(...eventRows(treeId, "family", familyId, fam.events));
  }
  await batchInsert(eventsTable, eventInsertRows);

  // ----- Sources: dedupe by GEDCOM xref so re-import doesn't duplicate. ------
  const xrefToSourceId = new Map<string, string>();
  const existingSources = await db
    .select({ id: sourcesTable.id, xref: sourcesTable.gedcomXref })
    .from(sourcesTable)
    .where(eq(sourcesTable.treeId, treeId));
  for (const s of existingSources) {
    if (s.xref) xrefToSourceId.set(s.xref, s.id);
  }
  const newSources = sources.filter((s) => !xrefToSourceId.has(s.xref));
  for (let i = 0; i < newSources.length; i += BATCH_SIZE) {
    const chunk = newSources.slice(i, i + BATCH_SIZE).map((s) => ({
      treeId,
      gedcomXref: s.xref,
      title: s.title ?? null,
      author: s.author ?? null,
      publication: s.publication ?? null,
      repositoryName: s.repositoryName ?? null,
    }));
    const inserted = await db
      .insert(sourcesTable)
      .values(chunk)
      .returning({ id: sourcesTable.id, xref: sourcesTable.gedcomXref });
    for (const row of inserted) {
      if (row.xref) xrefToSourceId.set(row.xref, row.id);
    }
  }

  // ----- Citations: attach to any person who has none yet (covers new people
  // AND people imported before source support), so it's idempotent. -----------
  const citedRows = await db
    .selectDistinct({ personId: citationsTable.personId })
    .from(citationsTable)
    .where(eq(citationsTable.treeId, treeId));
  const alreadyCited = new Set(citedRows.map((r) => r.personId));

  const citationRows: {
    treeId: string;
    sourceId: string;
    personId: string;
    eventType: string | null;
    page: string | null;
  }[] = [];
  for (const indi of individuals) {
    const personId = xrefToPersonId.get(indi.xref);
    if (!personId || alreadyCited.has(personId)) continue;
    for (const c of indi.citations) {
      const sourceId = xrefToSourceId.get(c.sourceXref);
      if (!sourceId) continue;
      citationRows.push({
        treeId,
        sourceId,
        personId,
        eventType: c.eventType ?? null,
        page: c.page ?? null,
      });
    }
  }
  await batchInsert(citationsTable, citationRows);

  return {
    persons: insertedPersons,
    mergedPeople: merged,
    families: familiesToInsert.length,
    children: childRows.length,
    events: eventInsertRows.length,
    sources: xrefToSourceId.size,
    citations: citationRows.length,
  };
}
