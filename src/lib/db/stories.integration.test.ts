import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, trees, persons, stories } from "./schema";
import { getPersonStories } from "./queries";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("stories (integration)", () => {
  let userId: string;
  let treeId: string;
  let personId: string;

  beforeAll(async () => {
    const [u] = await db
      .insert(users)
      .values({
        clerkId: `test_${randomUUID()}`,
        email: `test-${randomUUID()}@example.test`,
        name: "Aunt May",
      })
      .returning();
    userId = u.id;
    const [t] = await db
      .insert(trees)
      .values({ name: `TEST ${randomUUID()}`, ownerId: userId })
      .returning();
    treeId = t.id;
    const [p] = await db
      .insert(persons)
      .values({ treeId, givenName: "Grandma", surname: "Doe", sex: "F" })
      .returning();
    personId = p.id;
  });

  afterAll(async () => {
    if (treeId) await db.delete(trees).where(eq(trees.id, treeId));
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  it("creates, lists (with author), and deletes a story", async () => {
    const [story] = await db
      .insert(stories)
      .values({
        treeId,
        personId,
        authorId: userId,
        title: "Her famous pie",
        body: "She baked the best apple pie every Sunday.",
      })
      .returning();

    const listed = await getPersonStories(personId);
    expect(listed).toHaveLength(1);
    expect(listed[0].title).toBe("Her famous pie");
    expect(listed[0].authorName).toBe("Aunt May");

    await db.delete(stories).where(eq(stories.id, story.id));
    expect(await getPersonStories(personId)).toHaveLength(0);
  });
});
