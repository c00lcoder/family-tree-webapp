/**
 * Serialize a normalized person/family graph back into GEDCOM 5.5.1 text.
 * Works on plain rows so it is unit-testable without a database and round-trips
 * with `parseGedcom`.
 */

export interface ExportPerson {
  id: string;
  givenName?: string | null;
  surname?: string | null;
  suffix?: string | null;
  sex?: "M" | "F" | "U" | null;
  notes?: string | null;
}

export interface ExportFamily {
  id: string;
  partner1Id?: string | null;
  partner2Id?: string | null;
}

export interface ExportEvent {
  subject: "person" | "family";
  personId?: string | null;
  familyId?: string | null;
  type: string;
  dateRaw?: string | null;
  place?: string | null;
}

export interface ExportChild {
  familyId: string;
  childId: string;
}

export interface ExportInput {
  persons: ExportPerson[];
  families: ExportFamily[];
  children: ExportChild[];
  events: ExportEvent[];
}

function nameLine(p: ExportPerson): string {
  const given = (p.givenName ?? "").trim();
  const surname = (p.surname ?? "").trim();
  const suffix = (p.suffix ?? "").trim();
  let value = given;
  value += ` /${surname}/`;
  if (suffix) value += ` ${suffix}`;
  return value.trim();
}

function pushMultiline(lines: string[], tag: string, text: string) {
  const parts = text.split(/\r\n|\r|\n/);
  lines.push(`1 ${tag} ${parts[0]}`);
  for (let i = 1; i < parts.length; i++) {
    lines.push(`2 CONT ${parts[i]}`);
  }
}

function eventBlock(
  lines: string[],
  ev: ExportEvent,
) {
  lines.push(`1 ${ev.type}`);
  if (ev.dateRaw) lines.push(`2 DATE ${ev.dateRaw}`);
  if (ev.place) lines.push(`2 PLAC ${ev.place}`);
}

export function exportGedcom(input: ExportInput): string {
  const lines: string[] = [];

  // Assign clean, sequential xrefs.
  const personXref = new Map<string, string>();
  input.persons.forEach((p, i) => personXref.set(p.id, `@I${i + 1}@`));
  const familyXref = new Map<string, string>();
  input.families.forEach((f, i) => familyXref.set(f.id, `@F${i + 1}@`));

  const childrenByFamily = new Map<string, string[]>();
  for (const c of input.children) {
    const list = childrenByFamily.get(c.familyId) ?? [];
    list.push(c.childId);
    childrenByFamily.set(c.familyId, list);
  }

  const personEvents = new Map<string, ExportEvent[]>();
  const familyEvents = new Map<string, ExportEvent[]>();
  for (const ev of input.events) {
    if (ev.subject === "person" && ev.personId) {
      const list = personEvents.get(ev.personId) ?? [];
      list.push(ev);
      personEvents.set(ev.personId, list);
    } else if (ev.subject === "family" && ev.familyId) {
      const list = familyEvents.get(ev.familyId) ?? [];
      list.push(ev);
      familyEvents.set(ev.familyId, list);
    }
  }

  // Header
  lines.push("0 HEAD");
  lines.push("1 SOUR FamilyTreeWebapp");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("2 FORM LINEAGE-LINKED");
  lines.push("1 CHAR UTF-8");

  // Individuals
  for (const p of input.persons) {
    lines.push(`0 ${personXref.get(p.id)} INDI`);
    lines.push(`1 NAME ${nameLine(p)}`);
    if (p.givenName?.trim()) lines.push(`2 GIVN ${p.givenName.trim()}`);
    if (p.surname?.trim()) lines.push(`2 SURN ${p.surname.trim()}`);
    if (p.suffix?.trim()) lines.push(`2 NSFX ${p.suffix.trim()}`);
    if (p.sex === "M" || p.sex === "F") lines.push(`1 SEX ${p.sex}`);
    for (const ev of personEvents.get(p.id) ?? []) eventBlock(lines, ev);
    if (p.notes?.trim()) pushMultiline(lines, "NOTE", p.notes.trim());
  }

  // Families
  for (const f of input.families) {
    lines.push(`0 ${familyXref.get(f.id)} FAM`);

    // Pick HUSB/WIFE by sex where known, else partner1 -> HUSB, partner2 -> WIFE.
    const sexOf = (id?: string | null) =>
      id ? input.persons.find((p) => p.id === id)?.sex : undefined;
    let husb = f.partner1Id ?? undefined;
    let wife = f.partner2Id ?? undefined;
    if (sexOf(f.partner1Id) === "F" || sexOf(f.partner2Id) === "M") {
      husb = f.partner2Id ?? undefined;
      wife = f.partner1Id ?? undefined;
    }
    if (husb && personXref.has(husb))
      lines.push(`1 HUSB ${personXref.get(husb)}`);
    if (wife && personXref.has(wife))
      lines.push(`1 WIFE ${personXref.get(wife)}`);
    for (const childId of childrenByFamily.get(f.id) ?? []) {
      if (personXref.has(childId))
        lines.push(`1 CHIL ${personXref.get(childId)}`);
    }
    for (const ev of familyEvents.get(f.id) ?? []) eventBlock(lines, ev);
  }

  lines.push("0 TRLR");
  return lines.join("\n") + "\n";
}
