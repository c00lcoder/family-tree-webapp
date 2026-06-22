export type Sex = "M" | "F" | "U";

export interface GedcomEvent {
  type: string; // BIRT, DEAT, MARR, DIV, ...
  date?: string;
  place?: string;
}

export interface GedcomCitation {
  sourceXref: string;
  page?: string;
  // The event this citation supports (e.g. "BIRT"); absent for person-level.
  eventType?: string;
}

export interface GedcomSource {
  xref: string;
  title?: string;
  author?: string;
  publication?: string;
  repositoryName?: string;
}

export interface GedcomIndividual {
  xref: string;
  givenName?: string;
  surname?: string;
  suffix?: string;
  sex: Sex;
  notes?: string;
  events: GedcomEvent[];
  citations: GedcomCitation[];
}

export interface GedcomFamily {
  xref: string;
  husbandXref?: string;
  wifeXref?: string;
  childXrefs: string[];
  events: GedcomEvent[];
}

export interface NormalizedGedcom {
  individuals: GedcomIndividual[];
  families: GedcomFamily[];
  sources: GedcomSource[];
}
