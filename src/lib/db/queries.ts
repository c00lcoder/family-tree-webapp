import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "./index";
import {
  trees,
  treeMembers,
  persons,
  families,
  familyChildren,
  events,
  media,
} from "./schema";
import {
  toFamilyChart,
  type FamilyChartDatum,
} from "@/lib/gedcom/to-family-chart";

export type Relationship =
  | "father"
  | "mother"
  | "spouse"
  | "son"
  | "daughter"
  | "brother"
  | "sister";

const SEX_BY_RELATIONSHIP: Record<Relationship, "M" | "F" | "U"> = {
  father: "M",
  mother: "F",
  son: "M",
  daughter: "F",
  brother: "M",
  sister: "F",
  spouse: "U",
};

export const MAX_ADMINS_PER_TREE = 2;

export type TreeAccess = "owner" | "admin" | "member" | null;

/** Resolve a user's level of access to a tree (null = no access). */
export async function getTreeAccess(
  treeId: string,
  userId: string,
): Promise<TreeAccess> {
  const tree = await db.query.trees.findFirst({ where: eq(trees.id, treeId) });
  if (!tree) return null;
  if (tree.ownerId === userId) return "owner";

  const membership = await db.query.treeMembers.findFirst({
    where: and(
      eq(treeMembers.treeId, treeId),
      eq(treeMembers.userId, userId),
      eq(treeMembers.status, "active"),
    ),
  });
  if (!membership) return null;
  return membership.role === "admin" ? "admin" : "member";
}

export function canEdit(access: TreeAccess): boolean {
  return access === "owner" || access === "admin" || access === "member";
}

export function canManage(access: TreeAccess): boolean {
  return access === "owner" || access === "admin";
}

/** Trees the user owns or is an active member of. */
export async function listTreesForUser(userId: string) {
  const memberRows = await db
    .select({ treeId: treeMembers.treeId })
    .from(treeMembers)
    .where(
      and(eq(treeMembers.userId, userId), eq(treeMembers.status, "active")),
    );
  const memberTreeIds = memberRows.map((r) => r.treeId);

  return db.query.trees.findMany({
    where: or(
      eq(trees.ownerId, userId),
      memberTreeIds.length ? inArray(trees.id, memberTreeIds) : undefined,
    ),
    orderBy: desc(trees.updatedAt),
  });
}

export async function createTree(input: {
  name: string;
  description?: string;
  ownerId: string;
}) {
  const [tree] = await db
    .insert(trees)
    .values({
      name: input.name,
      description: input.description ?? null,
      ownerId: input.ownerId,
    })
    .returning();
  return tree;
}

/** Build the family-chart payload for a tree. */
export async function getTreeGraph(treeId: string): Promise<FamilyChartDatum[]> {
  const [personRows, familyRows, childRows, mediaRows] = await Promise.all([
    db.select().from(persons).where(eq(persons.treeId, treeId)),
    db.select().from(families).where(eq(families.treeId, treeId)),
    db
      .select({
        familyId: familyChildren.familyId,
        childId: familyChildren.childId,
      })
      .from(familyChildren)
      .innerJoin(families, eq(familyChildren.familyId, families.id))
      .where(eq(families.treeId, treeId)),
    db.select().from(media).where(eq(media.treeId, treeId)),
  ]);

  const avatarById = new Map<string, string>();
  for (const m of mediaRows) avatarById.set(m.id, m.storageKey);

  // Note: storageKey -> public URL resolution happens in the route layer where
  // the storage adapter lives; here we attach the avatar media id's key.
  const personInput = personRows.map((p) => ({
    id: p.id,
    givenName: p.givenName,
    surname: p.surname,
    suffix: p.suffix,
    sex: p.sex,
    avatarUrl: p.avatarMediaId
      ? (avatarById.get(p.avatarMediaId) ?? null)
      : null,
  }));

  return toFamilyChart(personInput, familyRows, childRows);
}

/**
 * Create a new person and wire them to an existing person by `relationship`.
 * The family-chart layout re-flows automatically once the relationships exist,
 * so the new card "falls into place" on the next graph load.
 */
export async function addRelative(
  treeId: string,
  personId: string,
  relationship: Relationship,
  data: { givenName?: string; surname?: string; suffix?: string },
) {
  const [newPerson] = await db
    .insert(persons)
    .values({
      treeId,
      givenName: data.givenName ?? null,
      surname: data.surname ?? null,
      suffix: data.suffix ?? null,
      sex: SEX_BY_RELATIONSHIP[relationship],
    })
    .returning();
  const newId = newPerson.id;

  // The family this person belongs to AS A CHILD (their parents' union).
  const parentFamily = async () => {
    const rows = await db
      .select({
        id: families.id,
        partner1Id: families.partner1Id,
        partner2Id: families.partner2Id,
      })
      .from(familyChildren)
      .innerJoin(families, eq(familyChildren.familyId, families.id))
      .where(
        and(eq(familyChildren.childId, personId), eq(families.treeId, treeId)),
      )
      .limit(1);
    return rows[0] ?? null;
  };

  // A family this person is a PARTNER in (their own union).
  const spouseFamilies = () =>
    db
      .select()
      .from(families)
      .where(
        and(
          eq(families.treeId, treeId),
          or(
            eq(families.partner1Id, personId),
            eq(families.partner2Id, personId),
          ),
        ),
      );

  const setOpenPartnerSlot = async (familyId: string, value: string) => {
    const [fam] = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1);
    if (!fam) return false;
    if (!fam.partner1Id) {
      await db
        .update(families)
        .set({ partner1Id: value })
        .where(eq(families.id, familyId));
      return true;
    }
    if (!fam.partner2Id) {
      await db
        .update(families)
        .set({ partner2Id: value })
        .where(eq(families.id, familyId));
      return true;
    }
    return false;
  };

  if (relationship === "father" || relationship === "mother") {
    const fam = await parentFamily();
    if (fam) {
      const placed = await setOpenPartnerSlot(fam.id, newId);
      if (!placed) {
        // Both parent slots already filled — start a fresh union for this parent.
        const [created] = await db
          .insert(families)
          .values({ treeId, partner1Id: newId })
          .returning();
        await db
          .insert(familyChildren)
          .values({ familyId: created.id, childId: personId });
      }
    } else {
      const [created] = await db
        .insert(families)
        .values({ treeId, partner1Id: newId })
        .returning();
      await db
        .insert(familyChildren)
        .values({ familyId: created.id, childId: personId });
    }
  } else if (relationship === "spouse") {
    const fams = await spouseFamilies();
    const open = fams.find((f) => !f.partner1Id || !f.partner2Id);
    if (open) {
      await setOpenPartnerSlot(open.id, newId);
    } else {
      await db
        .insert(families)
        .values({ treeId, partner1Id: personId, partner2Id: newId });
    }
  } else if (relationship === "son" || relationship === "daughter") {
    const fams = await spouseFamilies();
    let familyId = fams[0]?.id;
    if (!familyId) {
      const [created] = await db
        .insert(families)
        .values({ treeId, partner1Id: personId })
        .returning();
      familyId = created.id;
    }
    await db.insert(familyChildren).values({ familyId, childId: newId });
  } else {
    // brother / sister — share the same parent family.
    const fam = await parentFamily();
    let familyId = fam?.id;
    if (!familyId) {
      const [created] = await db
        .insert(families)
        .values({ treeId })
        .returning();
      familyId = created.id;
      await db
        .insert(familyChildren)
        .values({ familyId, childId: personId });
    }
    await db.insert(familyChildren).values({ familyId, childId: newId });
  }

  return newPerson;
}

/** All rows needed to serialize a tree to GEDCOM. */
export async function getTreeExportData(treeId: string) {
  const [personRows, familyRows, childRows, eventRows] = await Promise.all([
    db.select().from(persons).where(eq(persons.treeId, treeId)),
    db.select().from(families).where(eq(families.treeId, treeId)),
    db
      .select({
        familyId: familyChildren.familyId,
        childId: familyChildren.childId,
      })
      .from(familyChildren)
      .innerJoin(families, eq(familyChildren.familyId, families.id))
      .where(eq(families.treeId, treeId)),
    db.select().from(events).where(eq(events.treeId, treeId)),
  ]);
  return { personRows, familyRows, childRows, eventRows };
}

/** Count current admins (owner counts as one). */
export async function countAdmins(treeId: string): Promise<number> {
  const admins = await db
    .select({ id: treeMembers.id })
    .from(treeMembers)
    .where(
      and(
        eq(treeMembers.treeId, treeId),
        eq(treeMembers.role, "admin"),
        eq(treeMembers.status, "active"),
      ),
    );
  // +1 for the owner.
  return admins.length + 1;
}
