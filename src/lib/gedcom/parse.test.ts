import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseGedcom } from "./parse";

const sample = readFileSync(
  fileURLToPath(new URL("../../../fixtures/sample.ged", import.meta.url)),
  "utf-8",
);

describe("parseGedcom", () => {
  const result = parseGedcom(sample);

  it("extracts all individuals", () => {
    expect(result.individuals).toHaveLength(4);
  });

  it("parses names from /surname/ notation", () => {
    const john = result.individuals.find((i) => i.xref === "@I1@");
    expect(john?.givenName).toBe("John");
    expect(john?.surname).toBe("Doe");
  });

  it("parses sex", () => {
    expect(result.individuals.find((i) => i.xref === "@I2@")?.sex).toBe("F");
    expect(result.individuals.find((i) => i.xref === "@I1@")?.sex).toBe("M");
  });

  it("extracts birth events with date and place", () => {
    const john = result.individuals.find((i) => i.xref === "@I1@");
    const birth = john?.events.find((e) => e.type === "BIRT");
    expect(birth?.date).toBe("1 JAN 1950");
    expect(birth?.place).toBe("Springfield, USA");
  });

  it("captures notes", () => {
    const john = result.individuals.find((i) => i.xref === "@I1@");
    expect(john?.notes).toContain("Patriarch");
  });

  it("extracts families with partners and children", () => {
    expect(result.families).toHaveLength(1);
    const fam = result.families[0];
    expect(fam.husbandXref).toBe("@I1@");
    expect(fam.wifeXref).toBe("@I2@");
    expect(fam.childXrefs).toEqual(["@I3@", "@I4@"]);
  });

  it("extracts marriage events on the family", () => {
    const marr = result.families[0].events.find((e) => e.type === "MARR");
    expect(marr?.date).toBe("14 FEB 1974");
  });

  it("ignores malformed / empty lines gracefully", () => {
    const messy = "garbage line\n0 @I9@ INDI\n1 NAME Solo /Person/\n0 TRLR\n";
    const parsed = parseGedcom(messy);
    expect(parsed.individuals).toHaveLength(1);
    expect(parsed.individuals[0].surname).toBe("Person");
  });
});
