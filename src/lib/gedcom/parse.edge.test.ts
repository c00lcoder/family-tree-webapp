import { describe, it, expect } from "vitest";
import { parseGedcom } from "./parse";

describe("parseGedcom edge cases", () => {
  it("merges CONC (no separator) and CONT (newline) continuations in notes", () => {
    const ged = [
      "0 @I1@ INDI",
      "1 NAME Ann /Lee/",
      "1 NOTE First line",
      "2 CONT Second line",
      "2 CONC  continued",
      "0 TRLR",
    ].join("\n");
    const p = parseGedcom(ged).individuals[0];
    expect(p.notes).toBe("First line\nSecond line continued");
  });

  it("handles an individual with no NAME tag", () => {
    const ged = "0 @I1@ INDI\n1 SEX M\n0 TRLR\n";
    const p = parseGedcom(ged).individuals[0];
    expect(p.givenName).toBeUndefined();
    expect(p.surname).toBeUndefined();
    expect(p.sex).toBe("M");
  });

  it("treats a bare name with no slashes as the given name", () => {
    const ged = "0 @I1@ INDI\n1 NAME Madonna\n0 TRLR\n";
    const p = parseGedcom(ged).individuals[0];
    expect(p.givenName).toBe("Madonna");
    expect(p.surname).toBeUndefined();
  });

  it("normalizes lower-case tags", () => {
    const ged = "0 @i1@ indi\n1 name Bob /Roy/\n1 sex m\n0 trlr\n";
    const p = parseGedcom(ged).individuals[0];
    expect(p.givenName).toBe("Bob");
    expect(p.surname).toBe("Roy");
    expect(p.sex).toBe("M");
  });

  it("parses a family with a husband and children but no wife", () => {
    const ged = [
      "0 @I1@ INDI",
      "1 NAME Sam /Solo/",
      "0 @I2@ INDI",
      "1 NAME Kid /Solo/",
      "0 @F1@ FAM",
      "1 HUSB @I1@",
      "1 CHIL @I2@",
      "0 TRLR",
    ].join("\n");
    const fam = parseGedcom(ged).families[0];
    expect(fam.husbandXref).toBe("@I1@");
    expect(fam.wifeXref).toBeUndefined();
    expect(fam.childXrefs).toEqual(["@I2@"]);
  });

  it("returns empty result for empty input", () => {
    expect(parseGedcom("")).toEqual({
      individuals: [],
      families: [],
      sources: [],
    });
  });

  it("parses sources, repositories, and per-event citations", () => {
    const ged = [
      "0 @S1@ SOUR",
      "1 TITL 1950 United States Federal Census",
      "1 AUTH Ancestry.com",
      "1 PUBL Ancestry.com Operations, Inc.",
      "1 REPO @R1@",
      "0 @R1@ REPO",
      "1 NAME Ancestry.com",
      "0 @I1@ INDI",
      "1 NAME Anne /Nelson/",
      "1 BIRT",
      "2 DATE 1854",
      "2 SOUR @S1@",
      "3 PAGE Roll 5569; Page 76",
      "0 TRLR",
    ].join("\n");
    const result = parseGedcom(ged);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].title).toContain("1950");
    expect(result.sources[0].author).toBe("Ancestry.com");
    expect(result.sources[0].repositoryName).toBe("Ancestry.com");

    const indi = result.individuals[0];
    expect(indi.citations).toHaveLength(1);
    expect(indi.citations[0].sourceXref).toBe("@S1@");
    expect(indi.citations[0].eventType).toBe("BIRT");
    expect(indi.citations[0].page).toContain("Roll 5569");
  });

  it("accepts a Uint8Array (UTF-8) input", () => {
    const bytes = new TextEncoder().encode("0 @I1@ INDI\n1 NAME Zoë /Ng/\n0 TRLR\n");
    const p = parseGedcom(bytes).individuals[0];
    expect(p.givenName).toBe("Zoë");
    expect(p.surname).toBe("Ng");
  });
});
