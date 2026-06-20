import { db } from "@/lib/db";
import {
  persons as personsTable,
  families as familiesTable,
  familyChildren as familyChildrenTable,
  events as eventsTable,
} from "@/lib/db/schema";
import { parseGedcom } from "./parse";
import type { GedcomEvent } from "./types";

export interface ImportResult {
  persons: number;
  families: number;
  children: number;
  events: number;
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
    ...(subject === "person"
      ? { personId: ownerId }
      : { familyId: ownerId }),
    type: e.type,
    dateRaw: e.date ?? null,
    place: e.place ?? null,
  }));
}

/**
 * Parse a GEDCOM document and persist its individuals, families, child links
 * and events into the given tree. Inserts are batched for large files.
 */
export async function importGedcom(
  treeId: string,
  input: string | Uint8Array,
): Promise<ImportResult> {
  const { individuals, families } = parseGedcom(input);

  // 1. Insert persons, building an xref -> new uuid map.
  const xrefToPersonId = new Map<string, string>();
  const personRows = individuals.map((indi) => ({
    treeId,
    gedcomXref: indi.xref,
    givenName: indi.givenName ?? null,
    surname: indi.surname ?? null,
    sex: indi.sex,
    notes: indi.notes ?? null,
  }));

  let insertedPersons = 0;
  for (let i = 0; i < personRows.length; i += BATCH_SIZE) {
    const chunk = personRows.slice(i, i + BATCH_SIZE);
    const inserted = await db
      .insert(personsTable)
      .values(chunk)
      .returning({ id: personsTable.id, xref: personsTable.gedcomXref });
    for (const row of inserted) {
      if (row.xref) xrefToPersonId.set(row.xref, row.id);
    }
    insertedPersons += inserted.length;
  }

  // 2. Insert families, building an xref -> new uuid map.
  const familyRows = families.map((fam) => ({
    treeId,
    gedcomXref: fam.xref,
    partner1Id: fam.husbandXref
      ? (xrefToPersonId.get(fam.husbandXref) ?? null)
      : null,
    partner2Id: fam.wifeXref
      ? (xrefToPersonId.get(fam.wifeXref) ?? null)
      : null,
  }));

  const xrefToFamilyId = new Map<string, string>();
  for (let i = 0; i < familyRows.length; i += BATCH_SIZE) {
    const chunk = familyRows.slice(i, i + BATCH_SIZE);
    const inserted = await db
      .insert(familiesTable)
      .values(chunk)
      .returning({ id: familiesTable.id, xref: familiesTable.gedcomXref });
    for (const row of inserted) {
      if (row.xref) xrefToFamilyId.set(row.xref, row.id);
    }
  }

  // 3. Child links.
  const childRows: { familyId: string; childId: string }[] = [];
  for (const fam of families) {
    const familyId = xrefToFamilyId.get(fam.xref);
    if (!familyId) continue;
    for (const childXref of fam.childXrefs) {
      const childId = xrefToPersonId.get(childXref);
      if (childId) childRows.push({ familyId, childId });
    }
  }
  await batchInsert(familyChildrenTable, childRows);

  // 4. Events (person + family).
  const eventInsertRows: ReturnType<typeof eventRows> = [];
  for (const indi of individuals) {
    const personId = xrefToPersonId.get(indi.xref);
    if (personId)
      eventInsertRows.push(...eventRows(treeId, "person", personId, indi.events));
  }
  for (const fam of families) {
    const familyId = xrefToFamilyId.get(fam.xref);
    if (familyId)
      eventInsertRows.push(...eventRows(treeId, "family", familyId, fam.events));
  }
  await batchInsert(eventsTable, eventInsertRows);

  return {
    persons: insertedPersons,
    families: xrefToFamilyId.size,
    children: childRows.length,
    events: eventInsertRows.length,
  };
}
