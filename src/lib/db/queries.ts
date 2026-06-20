import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "./index";
import {
  trees,
  treeMembers,
  persons,
  families,
  familyChildren,
  media,
} from "./schema";
import {
  toFamilyChart,
  type FamilyChartDatum,
} from "@/lib/gedcom/to-family-chart";

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
    sex: p.sex,
    avatarUrl: p.avatarMediaId
      ? (avatarById.get(p.avatarMediaId) ?? null)
      : null,
  }));

  return toFamilyChart(personInput, familyRows, childRows);
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
