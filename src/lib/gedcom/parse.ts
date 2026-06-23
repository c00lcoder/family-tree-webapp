import type {
  GedcomCitation,
  GedcomEvent,
  GedcomFamily,
  GedcomIndividual,
  GedcomSource,
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

// Known life events / attributes worth keeping even without a date or place.
const KNOWN_EVENT_TAGS = new Set([
  "BIRT", "DEAT", "MARR", "DIV", "BURI", "CHR", "BAPM", "ENGA", "RESI",
  "CENS", "OCCU", "EDUC", "GRAD", "RETI", "IMMI", "EMIG", "NATU", "PROB",
  "WILL", "EVEN", "CONF", "ADOP", "BAPL", "ORDN", "MARB", "MARL",
]);

// Structural sub-records that are never events.
const NON_EVENT_TAGS = new Set([
  "NAME", "SEX", "FAMC", "FAMS", "HUSB", "WIFE", "CHIL", "SOUR", "NOTE",
  "OBJE", "CHAN", "RIN", "RFN", "AFN", "SUBM", "ANCI", "DESI", "RESN",
  "_UID", "_APID", "_WPID", "_HPID", "_TREE", "_ENV", "ASSO", "ALIA", "REFN",
]);

/**
 * Capture life events and attributes: anything recognized as an event, plus any
 * other sub-record that carries a date or place (e.g. residence, census). This
 * keeps far more of the file than a fixed whitelist would.
 */
function extractEvents(node: GedcomNode): GedcomEvent[] {
  const events: GedcomEvent[] = [];
  for (const child of node.children) {
    if (NON_EVENT_TAGS.has(child.tag)) continue;
    const date = findChild(child, "DATE")?.value?.trim();
    const place = findChild(child, "PLAC")?.value?.trim();
    const isEvent =
      KNOWN_EVENT_TAGS.has(child.tag) || Boolean(date) || Boolean(place);
    if (!isEvent) continue;
    events.push({
      type: child.tag,
      ...(date ? { date } : {}),
      ...(place ? { place } : {}),
    });
  }
  return events;
}

interface ParsedName {
  givenName?: string;
  surname?: string;
  suffix?: string;
}

function parseSingleName(nameNode: GedcomNode): ParsedName {
  // Prefer structured GIVN/SURN/NSFX if present.
  const givn = findChild(nameNode, "GIVN")?.value?.trim();
  const surn = findChild(nameNode, "SURN")?.value?.trim();
  const nsfx = findChild(nameNode, "NSFX")?.value?.trim();
  if (givn || surn || nsfx) {
    return {
      ...(givn ? { givenName: givn } : {}),
      ...(surn ? { surname: surn } : {}),
      ...(nsfx ? { suffix: nsfx } : {}),
    };
  }

  // Otherwise parse "Given Names /Surname/ Suffix" — anything after the closing
  // slash (e.g. "Jr", "Sr", "III") is the name suffix.
  const raw = nameNode.value ?? "";
  const match = raw.match(/^(.*?)\/(.*?)\/(.*)$/);
  if (match) {
    const givenName = match[1].trim();
    const surname = match[2].trim();
    const suffix = match[3].trim();
    return {
      ...(givenName ? { givenName } : {}),
      ...(surname ? { surname } : {}),
      ...(suffix ? { suffix } : {}),
    };
  }
  // No surname slashes at all — treat the whole value as the given name.
  const givenName = raw.trim();
  return givenName ? { givenName } : {};
}

function parseName(
  node: GedcomNode,
): ParsedName & { marriedSurnames?: string[] } {
  const nameNodes = node.children.filter((c) => c.tag === "NAME");
  if (!nameNodes.length) return {};

  const result: ParsedName = {};
  const married: string[] = [];
  let primarySet = false;
  for (const nameNode of nameNodes) {
    const type = findChild(nameNode, "TYPE")?.value?.trim().toLowerCase();
    const parsed = parseSingleName(nameNode);
    if (type === "married") {
      if (parsed.surname) married.push(parsed.surname);
    } else if (!primarySet) {
      // First non-married NAME is the primary (birth) name.
      Object.assign(result, parsed);
      primarySet = true;
    }
    // Some exporters use a _MARNM tag for the married name instead.
    const marnm = findChild(nameNode, "_MARNM")?.value?.trim();
    if (marnm) {
      const m = marnm.match(/\/(.*?)\//);
      married.push((m ? m[1] : marnm).trim());
    }
  }
  // De-duplicate while preserving order.
  const marriedSurnames = [...new Set(married.filter(Boolean))];
  return {
    ...result,
    ...(marriedSurnames.length ? { marriedSurnames } : {}),
  };
}

function parseSex(node: GedcomNode): Sex {
  const value = findChild(node, "SEX")?.value?.trim().toUpperCase();
  return value === "M" || value === "F" ? value : "U";
}

function citationNode(node: GedcomNode, eventType?: string): GedcomCitation | null {
  const ref = node.value?.trim();
  if (!ref || !ref.startsWith("@")) return null; // only pointer citations
  const page = findChild(node, "PAGE")?.value?.trim();
  return {
    sourceXref: ref,
    ...(page ? { page } : {}),
    ...(eventType ? { eventType } : {}),
  };
}

/**
 * Every citation attached to a person: person-level (`1 SOUR`) plus citations
 * nested under any sub-record (`1 NAME`/`1 BIRT`/`1 RESI`/… then `2 SOUR`),
 * which is how Ancestry/FamilySearch exports attach them. The sub-record tag is
 * captured as the citation's context.
 */
function extractCitations(node: GedcomNode): GedcomCitation[] {
  const out: GedcomCitation[] = [];
  for (const child of node.children) {
    if (child.tag === "SOUR") {
      const c = citationNode(child);
      if (c) out.push(c);
      continue;
    }
    for (const grandchild of child.children) {
      if (grandchild.tag !== "SOUR") continue;
      const c = citationNode(grandchild, child.tag);
      if (c) out.push(c);
    }
  }
  return out;
}

function buildRepositoryNames(nodes: GedcomNode[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of nodes) {
    if (node.tag === "REPO" && node.xref) {
      const name = findChild(node, "NAME")?.value?.trim();
      if (name) map.set(node.xref, name);
    }
  }
  return map;
}

function extractSources(
  nodes: GedcomNode[],
  repoNames: Map<string, string>,
): GedcomSource[] {
  const sources: GedcomSource[] = [];
  for (const node of nodes) {
    if (node.tag !== "SOUR" || !node.xref) continue;
    const title = findChild(node, "TITL")?.value?.trim();
    const author = findChild(node, "AUTH")?.value?.trim();
    const publication = findChild(node, "PUBL")?.value?.trim();
    const repoRef = findChild(node, "REPO")?.value?.trim();
    const repositoryName = repoRef ? repoNames.get(repoRef) : undefined;
    sources.push({
      xref: node.xref,
      ...(title ? { title } : {}),
      ...(author ? { author } : {}),
      ...(publication ? { publication } : {}),
      ...(repositoryName ? { repositoryName } : {}),
    });
  }
  return sources;
}

export function parseGedcom(input: string | Uint8Array): NormalizedGedcom {
  const text =
    typeof input === "string" ? input : new TextDecoder("utf-8").decode(input);
  const nodes = parseToTree(text);

  const individuals: GedcomIndividual[] = [];
  const families: GedcomFamily[] = [];
  const repoNames = buildRepositoryNames(nodes);
  const sources = extractSources(nodes, repoNames);

  for (const node of nodes) {
    if (node.tag === "INDI" && node.xref) {
      const { givenName, surname, suffix, marriedSurnames } = parseName(node);
      const notes = findChild(node, "NOTE")?.value?.trim();
      individuals.push({
        xref: node.xref,
        ...(givenName ? { givenName } : {}),
        ...(surname ? { surname } : {}),
        ...(marriedSurnames ? { marriedSurnames } : {}),
        ...(suffix ? { suffix } : {}),
        sex: parseSex(node),
        ...(notes ? { notes } : {}),
        events: extractEvents(node),
        citations: extractCitations(node),
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

  return { individuals, families, sources };
}
