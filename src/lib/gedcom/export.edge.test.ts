import { describe, it, expect } from "vitest";
import { exportGedcom } from "./export";
import { parseGedcom } from "./parse";

describe("exportGedcom edge cases", () => {
  it("preserves multi-line notes via CONT and round-trips them", () => {
    const ged = exportGedcom({
      persons: [
        { id: "p", givenName: "Ann", surname: "Lee", sex: "F", notes: "Line 1\nLine 2" },
      ],
      families: [],
      children: [],
      events: [],
    });
    expect(ged).toContain("1 NOTE Line 1");
    expect(ged).toContain("2 CONT Line 2");
    const p = parseGedcom(ged).individuals[0];
    expect(p.notes).toBe("Line 1\nLine 2");
  });

  it("handles a person with no surname", () => {
    const ged = exportGedcom({
      persons: [{ id: "p", givenName: "Madonna", sex: "F" }],
      families: [],
      children: [],
      events: [],
    });
    const p = parseGedcom(ged).individuals[0];
    expect(p.givenName).toBe("Madonna");
    expect(p.surname).toBeUndefined();
  });

  it("handles a person with no given name", () => {
    const ged = exportGedcom({
      persons: [{ id: "p", surname: "Smith", sex: "M" }],
      families: [],
      children: [],
      events: [],
    });
    const p = parseGedcom(ged).individuals[0];
    expect(p.surname).toBe("Smith");
    expect(p.givenName).toBeUndefined();
  });

  it("omits SEX for unknown and never crashes on empty data", () => {
    const ged = exportGedcom({
      persons: [{ id: "p", givenName: "Pat", sex: "U" }],
      families: [],
      children: [],
      events: [],
    });
    expect(ged).not.toMatch(/1 SEX/);
    expect(ged).toContain("0 TRLR");
  });

  it("round-trips a remarriage structure preserving parentage", () => {
    const input = {
      persons: [
        { id: "dad", givenName: "Dad", surname: "X", sex: "M" as const },
        { id: "w1", givenName: "W1", surname: "A", sex: "F" as const },
        { id: "w2", givenName: "W2", surname: "B", sex: "F" as const },
        { id: "a", givenName: "A", surname: "X", sex: "F" as const },
        { id: "b", givenName: "B", surname: "X", sex: "M" as const },
      ],
      families: [
        { id: "f1", partner1Id: "dad", partner2Id: "w1" },
        { id: "f2", partner1Id: "dad", partner2Id: "w2" },
      ],
      children: [
        { familyId: "f1", childId: "a" },
        { familyId: "f2", childId: "b" },
      ],
      events: [],
    };
    const parsed = parseGedcom(exportGedcom(input));
    expect(parsed.individuals).toHaveLength(5);
    expect(parsed.families).toHaveLength(2);
    // Each family keeps exactly one child.
    expect(parsed.families.every((f) => f.childXrefs.length === 1)).toBe(true);
  });
});
