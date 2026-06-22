export type Sex = "M" | "F" | "U";

export interface GedcomEvent {
  type: string; // BIRT, DEAT, MARR, DIV, ...
  date?: string;
  place?: string;
}

export interface GedcomIndividual {
  xref: string;
  givenName?: string;
  surname?: string;
  suffix?: string;
  sex: Sex;
  notes?: string;
  events: GedcomEvent[];
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
}
