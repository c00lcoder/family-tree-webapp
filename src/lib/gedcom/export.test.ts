import { describe, it, expect } from "vitest";
import { exportGedcom } from "./export";
import { parseGedcom } from "./parse";

describe("exportGedcom", () => {
  const persons = [
    { id: "p1", givenName: "John", surname: "Doe", sex: "M" as const },
    { id: "p2", givenName: "Jane", surname: "Smith", sex: "F" as const },
    {
      id: "p3",
      givenName: "Gerald Rolando",
      surname: "Carter",
      suffix: "Jr",
      sex: "M" as const,
    },
  ];
  const families = [{ id: "f1", partner1Id: "p1", partner2Id: "p2" }];
  const children = [{ familyId: "f1", childId: "p3" }];
  const events = [
    {
      subject: "person" as const,
      personId: "p1",
      type: "BIRT",
      dateRaw: "1 JAN 1950",
      place: "Springfield",
    },
    {
      subject: "family" as const,
      familyId: "f1",
      type: "MARR",
      dateRaw: "14 FEB 1974",
    },
  ];

  const ged = exportGedcom({ persons, families, children, events });

  it("emits a valid header and trailer", () => {
    expect(ged).toContain("0 HEAD");
    expect(ged.trimEnd().endsWith("0 TRLR")).toBe(true);
  });

  it("includes the name suffix in NAME and NSFX", () => {
    expect(ged).toContain("1 NAME Gerald Rolando /Carter/ Jr");
    expect(ged).toContain("2 NSFX Jr");
  });

  it("round-trips back through the parser", () => {
    const parsed = parseGedcom(ged);
    expect(parsed.individuals).toHaveLength(3);
    expect(parsed.families).toHaveLength(1);

    const carter = parsed.individuals.find((i) => i.surname === "Carter");
    expect(carter?.suffix).toBe("Jr");

    const fam = parsed.families[0];
    expect(fam.husbandXref).toBeDefined();
    expect(fam.wifeXref).toBeDefined();
    expect(fam.childXrefs).toHaveLength(1);

    const john = parsed.individuals.find((i) => i.givenName === "John");
    expect(john?.events.find((e) => e.type === "BIRT")?.date).toBe(
      "1 JAN 1950",
    );
  });

  it("assigns HUSB/WIFE by sex", () => {
    // p1 (M) should be HUSB, p2 (F) should be WIFE.
    const parsed = parseGedcom(ged);
    const fam = parsed.families[0];
    const husb = parsed.individuals.find((i) => i.xref === fam.husbandXref);
    const wife = parsed.individuals.find((i) => i.xref === fam.wifeXref);
    expect(husb?.sex).toBe("M");
    expect(wife?.sex).toBe("F");
  });
});
