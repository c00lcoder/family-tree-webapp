import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { users, trees, treeInvites, treeMembers } from "./schema";
import { claimInvitesForEmail, getTreeAccess } from "./queries";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("sharing / invites (integration)", () => {
  let ownerId: string;
  let treeId: string;
  let inviteeId: string;
  const inviteeEmail = `invitee-${randomUUID()}@example.test`;

  beforeAll(async () => {
    const [owner] = await db
      .insert(users)
      .values({ clerkId: `test_${randomUUID()}`, email: `owner-${randomUUID()}@example.test` })
      .returning();
    ownerId = owner.id;
    const [t] = await db
      .insert(trees)
      .values({ name: `TEST ${randomUUID()}`, ownerId })
      .returning();
    treeId = t.id;
  });

  afterAll(async () => {
    if (treeId) await db.delete(trees).where(eq(trees.id, treeId));
    if (ownerId) await db.delete(users).where(eq(users.id, ownerId));
    if (inviteeId) await db.delete(users).where(eq(users.id, inviteeId));
  });

  it("claims a pending invite into a membership when the email signs up", async () => {
    // Invite an email that has no account yet.
    await db
      .insert(treeInvites)
      .values({ treeId, email: inviteeEmail, role: "member" });

    // That person signs up.
    const [invitee] = await db
      .insert(users)
      .values({ clerkId: `test_${randomUUID()}`, email: inviteeEmail })
      .returning();
    inviteeId = invitee.id;

    const claimed = await claimInvitesForEmail(inviteeEmail, inviteeId);
    expect(claimed).toBe(1);

    // Membership exists, access granted, invite consumed.
    const membership = await db
      .select()
      .from(treeMembers)
      .where(
        and(eq(treeMembers.treeId, treeId), eq(treeMembers.userId, inviteeId)),
      );
    expect(membership).toHaveLength(1);
    expect(await getTreeAccess(treeId, inviteeId)).toBe("member");

    const remaining = await db
      .select()
      .from(treeInvites)
      .where(eq(treeInvites.email, inviteeEmail));
    expect(remaining).toHaveLength(0);
  });

  it("is a no-op for an email with no invites", async () => {
    expect(await claimInvitesForEmail(`none-${randomUUID()}@x.test`, ownerId)).toBe(0);
  });
});
