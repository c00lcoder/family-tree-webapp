import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, trees, persons } from "@/lib/db/schema";
import { importGedcom } from "./import";

const hasDb = !!process.env.DATABASE_URL;
const sample = readFileSync(
  fileURLToPath(new URL("../../../fixtures/sample.ged", import.meta.url)),
  "utf-8",
);

describe.skipIf(!hasDb)("importGedcom merge/dedup (integration)", () => {
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
    if (treeId) await db.delete(trees).where(eq(trees.id, treeId));
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  it("imports fresh, then re-imports the same file without duplicating", async () => {
    const first = await importGedcom(treeId, sample);
    expect(first.persons).toBe(4);
    expect(first.mergedPeople).toBe(0);

    const countAfterFirst = (
      await db.select().from(persons).where(eq(persons.treeId, treeId))
    ).length;
    expect(countAfterFirst).toBe(4);

    // Re-import the identical file: everyone should match and merge, nothing new.
    const second = await importGedcom(treeId, sample);
    expect(second.persons).toBe(0);
    expect(second.mergedPeople).toBe(4);
    expect(second.families).toBe(0);

    const countAfterSecond = (
      await db.select().from(persons).where(eq(persons.treeId, treeId))
    ).length;
    expect(countAfterSecond).toBe(4);
  });
});
