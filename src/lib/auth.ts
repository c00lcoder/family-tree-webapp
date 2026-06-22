import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { claimInvitesForEmail } from "@/lib/db/queries";

/**
 * Resolve the Clerk-authenticated request to our local DB user, creating it on
 * first use as a fallback if the webhook hasn't synced yet.
 */
export async function getCurrentDbUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  });
  if (existing) return existing;

  // Fallback sync (webhook is the primary path).
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    "";
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  const [created] = await db
    .insert(users)
    .values({
      clerkId: userId,
      email,
      name,
      imageUrl: clerkUser.imageUrl,
    })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { email, name, imageUrl: clerkUser.imageUrl, updatedAt: new Date() },
    })
    .returning();

  // First-time sync (e.g. local dev without a webhook): claim any pending
  // invites for this email so invited family members get immediate access.
  if (created && email) {
    await claimInvitesForEmail(email, created.id);
  }

  return created;
}

/** Throwing variant for use inside API route handlers. */
export async function requireDbUser() {
  const user = await getCurrentDbUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
