/**
 * Transform our normalized person/family graph into the data shape the
 * `family-chart` library expects:
 *
 *   { id, data: { "first name", "last name", gender, avatar }, rels: { father, mother, spouses, children } }
 *
 * Works on plain rows so it can be unit-tested without a database.
 */

export interface PersonRow {
  id: string;
  givenName?: string | null;
  surname?: string | null;
  marriedSurnames?: string[] | null;
  suffix?: string | null;
  sex?: "M" | "F" | "U" | null;
  avatarUrl?: string | null;
  avatarFocusX?: number | null;
  avatarFocusY?: number | null;
}

export interface FamilyRow {
  id: string;
  partner1Id?: string | null;
  partner2Id?: string | null;
}

export interface FamilyChildRow {
  familyId: string;
  childId: string;
}

export interface FamilyChartDatum {
  id: string;
  data: {
    "first name": string;
    "last name": string;
    gender: "M" | "F";
    avatar?: string;
    focusX?: number;
    focusY?: number;
  };
  rels: {
    father?: string;
    mother?: string;
    spouses: string[];
    children: string[];
  };
}

/**
 * Pick the person whose descendant tree covers the most of the family — i.e. the
 * earliest ancestor of the largest branch. Centering family-chart here shows the
 * widest view instead of a thin ancestor line from someone near the bottom.
 */
export function bestRootId(data: FamilyChartDatum[]): string | null {
  if (data.length === 0) return null;
  const byId = new Map(data.map((d) => [d.id, d]));

  const descendantReach = (startId: string): number => {
    const seen = new Set<string>([startId]);
    const stack = [startId];
    while (stack.length) {
      const d = byId.get(stack.pop()!);
      if (!d) continue;
      for (const c of d.rels.children) {
        if (c && !seen.has(c)) {
          seen.add(c);
          stack.push(c);
        }
      }
    }
    // Count married-in spouses of every descendant too.
    for (const id of Array.from(seen)) {
      byId.get(id)?.rels.spouses.forEach((s) => seen.add(s));
    }
    return seen.size;
  };

  let bestId = data[0].id;
  let best = -1;
  for (const d of data) {
    const reach = descendantReach(d.id);
    if (reach > best) {
      best = reach;
      bestId = d.id;
    }
  }
  return bestId;
}

export function toFamilyChart(
  persons: PersonRow[],
  families: FamilyRow[],
  children: FamilyChildRow[],
): FamilyChartDatum[] {
  const byId = new Map<string, FamilyChartDatum>();

  for (const p of persons) {
    // Show married name(s) as the displayed surname, with the birth surname in
    // parentheses — e.g. "Doe (Smith)" or "Doe / Roe (Smith)".
    const married = (p.marriedSurnames ?? []).filter(Boolean);
    const primary = married.length ? married.join(" / ") : (p.surname ?? "");
    const maiden =
      married.length && p.surname && !married.includes(p.surname)
        ? `(${p.surname})`
        : "";
    const lastName = [primary, p.suffix, maiden].filter(Boolean).join(" ");
    byId.set(p.id, {
      id: p.id,
      data: {
        "first name": p.givenName ?? "",
        "last name": lastName,
        // family-chart only understands M/F; treat unknown as M for layout.
        gender: p.sex === "F" ? "F" : "M",
        ...(p.avatarUrl
          ? {
              avatar: p.avatarUrl,
              focusX: p.avatarFocusX ?? 50,
              focusY: p.avatarFocusY ?? 50,
            }
          : {}),
      },
      rels: { spouses: [], children: [] },
    });
  }

  const sexOf = (id: string) => persons.find((p) => p.id === id)?.sex;
  const childrenByFamily = new Map<string, string[]>();
  for (const { familyId, childId } of children) {
    const list = childrenByFamily.get(familyId) ?? [];
    list.push(childId);
    childrenByFamily.set(familyId, list);
  }

  for (const fam of families) {
    const { partner1Id, partner2Id } = fam;

    // Link the two partners as spouses.
    if (partner1Id && partner2Id) {
      addUnique(byId.get(partner1Id)?.rels.spouses, partner2Id);
      addUnique(byId.get(partner2Id)?.rels.spouses, partner1Id);
    }

    // Decide which partner is father/mother by recorded sex (best effort).
    let fatherId = partner1Id ?? undefined;
    let motherId = partner2Id ?? undefined;
    if (partner1Id && sexOf(partner1Id) === "F") {
      fatherId = partner2Id ?? undefined;
      motherId = partner1Id;
    } else if (partner2Id && sexOf(partner2Id) === "M") {
      fatherId = partner2Id;
      motherId = partner1Id ?? undefined;
    }

    for (const childId of childrenByFamily.get(fam.id) ?? []) {
      const child = byId.get(childId);
      if (!child) continue;
      if (fatherId) {
        child.rels.father = fatherId;
        addUnique(byId.get(fatherId)?.rels.children, childId);
      }
      if (motherId) {
        child.rels.mother = motherId;
        addUnique(byId.get(motherId)?.rels.children, childId);
      }
    }
  }

  return Array.from(byId.values());
}

function addUnique(arr: string[] | undefined, value: string) {
  if (arr && !arr.includes(value)) arr.push(value);
}
