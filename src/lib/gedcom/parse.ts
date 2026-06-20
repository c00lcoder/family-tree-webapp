import type {
  GedcomEvent,
  GedcomFamily,
  GedcomIndividual,
  NormalizedGedcom,
  Sex,
} from "./types";

/**
 * Minimal, dependency-free GEDCOM 5.5.1 parser.
 *
 * GEDCOM is a line-based format: `LEVEL [@XREF@] TAG [VALUE]`. We build a node
 * tree (handling CONC/CONT continuation lines), then extract the INDI and FAM
 * records we care about. This covers the common exports from Ancestry,
 * FamilySearch, Gramps, etc. Exotic tags are ignored rather than erroring.
 */

interface GedcomNode {
  level: number;
  tag: string;
  xref?: string;
  value: string;
  children: GedcomNode[];
}

const LINE_RE = /^\s*(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/;

function parseToTree(text: string): GedcomNode[] {
  const root: GedcomNode = {
    level: -1,
    tag: "ROOT",
    value: "",
    children: [],
  };
  const stack: GedcomNode[] = [root];

  const lines = text.split(/\r\n|\r|\n/);
  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const match = LINE_RE.exec(rawLine);
    if (!match) continue;

    const level = Number(match[1]);
    const xrefOrTag = match[2];
    const tag = match[3].toUpperCase();
    const value = match[4] ?? "";

    // CONC appends without a separator; CONT adds a newline.
    if (tag === "CONC" || tag === "CONT") {
      const parent = stack[stack.length - 1];
      if (parent && parent !== root) {
        parent.value += (tag === "CONT" ? "\n" : "") + value;
      }
      continue;
    }

    const node: GedcomNode = {
      level,
      tag,
      xref: xrefOrTag,
      value,
      children: [],
    };

    // Pop the stack until we find this node's parent (level - 1).
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root.children;
}

function findChild(node: GedcomNode, tag: string): GedcomNode | undefined {
  return node.children.find((c) => c.tag === tag);
}

function extractEvents(node: GedcomNode): GedcomEvent[] {
  const eventTags = new Set([
    "BIRT",
    "DEAT",
    "MARR",
    "DIV",
    "BURI",
    "CHR",
    "BAPM",
    "ENGA",
  ]);
  const events: GedcomEvent[] = [];
  for (const child of node.children) {
    if (!eventTags.has(child.tag)) continue;
    const date = findChild(child, "DATE")?.value?.trim();
    const place = findChild(child, "PLAC")?.value?.trim();
    events.push({
      type: child.tag,
      ...(date ? { date } : {}),
      ...(place ? { place } : {}),
    });
  }
  return events;
}

function parseName(node: GedcomNode): {
  givenName?: string;
  surname?: string;
} {
  const nameNode = findChild(node, "NAME");
  if (!nameNode) return {};

  // Prefer structured GIVN/SURN if present.
  const givn = findChild(nameNode, "GIVN")?.value?.trim();
  const surn = findChild(nameNode, "SURN")?.value?.trim();
  if (givn || surn) {
    return {
      ...(givn ? { givenName: givn } : {}),
      ...(surn ? { surname: surn } : {}),
    };
  }

  // Otherwise parse "Given Names /Surname/".
  const raw = nameNode.value ?? "";
  const surnameMatch = raw.match(/\/(.*?)\//);
  const surname = surnameMatch?.[1]?.trim();
  const givenName = raw.replace(/\/.*?\//, "").trim();
  return {
    ...(givenName ? { givenName } : {}),
    ...(surname ? { surname } : {}),
  };
}

function parseSex(node: GedcomNode): Sex {
  const value = findChild(node, "SEX")?.value?.trim().toUpperCase();
  return value === "M" || value === "F" ? value : "U";
}

export function parseGedcom(input: string | Uint8Array): NormalizedGedcom {
  const text =
    typeof input === "string" ? input : new TextDecoder("utf-8").decode(input);
  const nodes = parseToTree(text);

  const individuals: GedcomIndividual[] = [];
  const families: GedcomFamily[] = [];

  for (const node of nodes) {
    if (node.tag === "INDI" && node.xref) {
      const { givenName, surname } = parseName(node);
      const notes = findChild(node, "NOTE")?.value?.trim();
      individuals.push({
        xref: node.xref,
        ...(givenName ? { givenName } : {}),
        ...(surname ? { surname } : {}),
        sex: parseSex(node),
        ...(notes ? { notes } : {}),
        events: extractEvents(node),
      });
    } else if (node.tag === "FAM" && node.xref) {
      const husband = findChild(node, "HUSB")?.value?.trim();
      const wife = findChild(node, "WIFE")?.value?.trim();
      const childXrefs = node.children
        .filter((c) => c.tag === "CHIL")
        .map((c) => c.value.trim())
        .filter(Boolean);
      families.push({
        xref: node.xref,
        ...(husband ? { husbandXref: husband } : {}),
        ...(wife ? { wifeXref: wife } : {}),
        childXrefs,
        events: extractEvents(node),
      });
    }
  }

  return { individuals, families };
}
