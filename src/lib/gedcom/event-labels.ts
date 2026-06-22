/** Human labels for GEDCOM event / citation-context tags. */
export const EVENT_LABELS: Record<string, string> = {
  BIRT: "Birth",
  DEAT: "Death",
  MARR: "Marriage",
  DIV: "Divorce",
  BURI: "Burial",
  CHR: "Christening",
  BAPM: "Baptism",
  ENGA: "Engagement",
  NAME: "Name",
  RESI: "Residence",
  CENS: "Census",
  OCCU: "Occupation",
  IMMI: "Immigration",
  EMIG: "Emigration",
  EDUC: "Education",
  PROB: "Probate",
};

export function eventLabel(type: string | null | undefined): string {
  if (!type) return "Record";
  return EVENT_LABELS[type] ?? type;
}
