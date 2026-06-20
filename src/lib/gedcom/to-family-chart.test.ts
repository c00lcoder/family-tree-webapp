import { describe, it, expect } from "vitest";
import { toFamilyChart } from "./to-family-chart";

describe("toFamilyChart", () => {
  const persons = [
    { id: "p1", givenName: "John", surname: "Doe", sex: "M" as const },
    { id: "p2", givenName: "Jane", surname: "Smith", sex: "F" as const },
    { id: "p3", givenName: "Alice", surname: "Doe", sex: "F" as const },
    { id: "p4", givenName: "Bob", surname: "Doe", sex: "M" as const },
  ];
  const families = [{ id: "f1", partner1Id: "p1", partner2Id: "p2" }];
  const children = [
    { familyId: "f1", childId: "p3" },
    { familyId: "f1", childId: "p4" },
  ];

  const result = toFamilyChart(persons, families, children);
  const byId = Object.fromEntries(result.map((d) => [d.id, d]));

  it("emits one datum per person", () => {
    expect(result).toHaveLength(4);
  });

  it("links spouses bidirectionally", () => {
    expect(byId.p1.rels.spouses).toContain("p2");
    expect(byId.p2.rels.spouses).toContain("p1");
  });

  it("assigns father/mother by sex", () => {
    expect(byId.p3.rels.father).toBe("p1");
    expect(byId.p3.rels.mother).toBe("p2");
  });

  it("lists children on both parents", () => {
    expect(byId.p1.rels.children.sort()).toEqual(["p3", "p4"]);
    expect(byId.p2.rels.children.sort()).toEqual(["p3", "p4"]);
  });

  it("maps name and gender into data", () => {
    expect(byId.p1.data["first name"]).toBe("John");
    expect(byId.p1.data["last name"]).toBe("Doe");
    expect(byId.p2.data.gender).toBe("F");
  });

  it("includes avatar when provided", () => {
    const withAvatar = toFamilyChart(
      [{ id: "x", givenName: "A", surname: "B", sex: "M", avatarUrl: "u" }],
      [],
      [],
    );
    expect(withAvatar[0].data.avatar).toBe("u");
  });
});
