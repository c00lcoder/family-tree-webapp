import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, trees, persons, familyChildren } from "./schema";
import { addRelative, getTreeGraph } from "./queries";

const hasDb = !!process.env.DATABASE_URL;

// Integration tests against the real (Neon) database. They create a clearly
// marked temporary user + tree and delete them afterwards, leaving no residue.
describe.skipIf(!hasDb)("relationship engine (integration)", () => {
  let userId: string;
  let treeId: string;

  beforeAll(async () => {
    const [u] = await db
      .insert(users)
      .values({
        clerkId: `test_${randomUUID()}`,
        email: `test-${randomUUID()}@example.test`,
      })
      .returning();
    userId = u.id;
    const [t] = await db
      .insert(trees)
      .values({ name: `TEST ${randomUUID()}`, ownerId: userId })
      .returning();
    treeId = t.id;
  });

  afterAll(async () => {
    // Tree delete cascades persons/families/children; then remove the user.
    if (treeId) await db.delete(trees).where(eq(trees.id, treeId));
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  async function newRoot(sex: "M" | "F" | "U" = "M") {
    const [p] = await db
      .insert(persons)
      .values({ treeId, givenName: "Root", surname: "Person", sex })
      .returning();
    return p.id;
  }

  const datum = async (id: string) =>
    (await getTreeGraph(treeId)).find((d) => d.id === id)!;

  it("adds a father and links the child to that parent", async () => {
    const root = await newRoot("M");
    const father = await addRelative(treeId, root, "father", { givenName: "Dad" });
    const d = await datum(root);
    expect(d.rels.father).toBe(father.id);
  });

  it("adds a mother", async () => {
    const root = await newRoot("M");
    const mother = await addRelative(treeId, root, "mother", { givenName: "Mom" });
    const d = await datum(root);
    expect(d.rels.mother).toBe(mother.id);
  });

  it("adds father and mother into the SAME family", async () => {
    const root = await newRoot("F");
    await addRelative(treeId, root, "father", { givenName: "Pa" });
    await addRelative(treeId, root, "mother", { givenName: "Ma" });
    const d = await datum(root);
    expect(d.rels.father).toBeDefined();
    expect(d.rels.mother).toBeDefined();
    // Exactly one parent family should contain the root as a child.
    const rows = await db
      .select({ familyId: familyChildren.familyId })
      .from(familyChildren)
      .where(eq(familyChildren.childId, root));
    expect(rows).toHaveLength(1);
  });

  it("adds a spouse (bidirectional)", async () => {
    const root = await newRoot("M");
    const spouse = await addRelative(treeId, root, "spouse", { givenName: "Partner" });
    const d = await datum(root);
    const s = await datum(spouse.id);
    expect(d.rels.spouses).toContain(spouse.id);
    expect(s.rels.spouses).toContain(root);
  });

  it("adds a child and links it back to the parent", async () => {
    const root = await newRoot("M");
    const son = await addRelative(treeId, root, "son", { givenName: "Son" });
    const d = await datum(root);
    const s = await datum(son.id);
    expect(d.rels.children).toContain(son.id);
    expect(s.rels.father).toBe(root);
  });

  it("adds a sibling into the same parent family", async () => {
    const root = await newRoot("M");
    const sib = await addRelative(treeId, root, "brother", { givenName: "Bro" });
    const rootFams = await db
      .select({ familyId: familyChildren.familyId })
      .from(familyChildren)
      .where(eq(familyChildren.childId, root));
    const sibFams = await db
      .select({ familyId: familyChildren.familyId })
      .from(familyChildren)
      .where(eq(familyChildren.childId, sib.id));
    expect(rootFams.length).toBeGreaterThan(0);
    expect(sibFams.map((r) => r.familyId)).toContain(rootFams[0].familyId);
  });

  it("deleting a person cascades its child links", async () => {
    const root = await newRoot("M");
    const son = await addRelative(treeId, root, "son", { givenName: "Temp" });
    await db.delete(persons).where(eq(persons.id, son.id));
    const links = await db
      .select()
      .from(familyChildren)
      .where(eq(familyChildren.childId, son.id));
    expect(links).toHaveLength(0);
  });
});
