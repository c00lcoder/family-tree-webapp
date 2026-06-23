import { describe, it, expect } from "vitest";
import { toFamilyChart, bestRootId } from "./to-family-chart";

describe("bestRootId", () => {
  it("picks the ancestor with the largest descendant tree", () => {
    // gp -> p -> (c1, c2); a lone unrelated person.
    const data = toFamilyChart(
      [
        { id: "gp", sex: "M" },
        { id: "p", sex: "M" },
        { id: "c1", sex: "F" },
        { id: "c2", sex: "M" },
        { id: "lone", sex: "F" },
      ],
      [
        { id: "f1", partner1Id: "gp", partner2Id: null },
        { id: "f2", partner1Id: "p", partner2Id: null },
      ],
      [
        { familyId: "f1", childId: "p" },
        { familyId: "f2", childId: "c1" },
        { familyId: "f2", childId: "c2" },
      ],
    );
    expect(bestRootId(data)).toBe("gp");
  });

  it("returns null for empty data", () => {
    expect(bestRootId([])).toBeNull();
  });
});

describe("toFamilyChart edge cases", () => {
  it("handles multiple spouses (remarriage) with children in each union", () => {
    const persons = [
      { id: "dad", givenName: "Dad", sex: "M" as const },
      { id: "w1", givenName: "Wife1", sex: "F" as const },
      { id: "w2", givenName: "Wife2", sex: "F" as const },
      { id: "a", givenName: "ChildA", sex: "F" as const },
      { id: "b", givenName: "ChildB", sex: "M" as const },
    ];
    const families = [
      { id: "f1", partner1Id: "dad", partner2Id: "w1" },
      { id: "f2", partner1Id: "dad", partner2Id: "w2" },
    ];
    const children = [
      { familyId: "f1", childId: "a" },
      { familyId: "f2", childId: "b" },
    ];
    const byId = Object.fromEntries(
      toFamilyChart(persons, families, children).map((d) => [d.id, d]),
    );

    // Dad is married to both, and each child descends from the correct couple.
    expect(byId.dad.rels.spouses.sort()).toEqual(["w1", "w2"]);
    expect(byId.dad.rels.children.sort()).toEqual(["a", "b"]);
    expect(byId.a.rels.father).toBe("dad");
    expect(byId.a.rels.mother).toBe("w1");
    expect(byId.b.rels.mother).toBe("w2");
  });

  it("supports a single-parent family", () => {
    const byId = Object.fromEntries(
      toFamilyChart(
        [
          { id: "m", givenName: "Mom", sex: "F" as const },
          { id: "c", givenName: "Kid", sex: "M" as const },
        ],
        [{ id: "f", partner1Id: "m", partner2Id: null }],
        [{ familyId: "f", childId: "c" }],
      ).map((d) => [d.id, d]),
    );
    expect(byId.c.rels.mother).toBe("m");
    expect(byId.c.rels.father).toBeUndefined();
    expect(byId.m.rels.children).toEqual(["c"]);
  });

  it("defaults unknown gender to M for layout", () => {
    const [d] = toFamilyChart(
      [{ id: "x", givenName: "Pat", sex: "U" as const }],
      [],
      [],
    );
    expect(d.data.gender).toBe("M");
  });

  it("does not crash when a child references a missing family/person", () => {
    const result = toFamilyChart(
      [{ id: "a", givenName: "A", sex: "M" as const }],
      [{ id: "f", partner1Id: "a", partner2Id: "ghost" }],
      [{ familyId: "f", childId: "missing" }],
    );
    expect(result).toHaveLength(1);
    // The ghost spouse is referenced but has no datum; should be ignored safely.
    expect(result[0].rels.spouses).toContain("ghost");
  });

  it("infers father/mother when partner sexes are reversed in the slots", () => {
    // partner1 is the mother (F), partner2 is the father (M).
    const byId = Object.fromEntries(
      toFamilyChart(
        [
          { id: "mom", sex: "F" as const },
          { id: "dad", sex: "M" as const },
          { id: "kid", sex: "F" as const },
        ],
        [{ id: "f", partner1Id: "mom", partner2Id: "dad" }],
        [{ familyId: "f", childId: "kid" }],
      ).map((d) => [d.id, d]),
    );
    expect(byId.kid.rels.father).toBe("dad");
    expect(byId.kid.rels.mother).toBe("mom");
  });
});
