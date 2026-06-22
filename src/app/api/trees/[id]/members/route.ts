import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { treeMembers, treeInvites, users } from "@/lib/db/schema";
import {
  MAX_ADMINS_PER_TREE,
  canManage,
  countAdmins,
  getTreeAccess,
  normalizeEmail,
} from "@/lib/db/queries";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { addMemberSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const access = await getTreeAccess(id, user.id);
  if (!access) return error("Not found", 404);

  const [members, invites, tree] = await Promise.all([
    db
      .select({
        role: treeMembers.role,
        status: treeMembers.status,
        userId: users.id,
        email: users.email,
        name: users.name,
        imageUrl: users.imageUrl,
      })
      .from(treeMembers)
      .innerJoin(users, eq(treeMembers.userId, users.id))
      .where(eq(treeMembers.treeId, id)),
    db
      .select({
        id: treeInvites.id,
        email: treeInvites.email,
        role: treeInvites.role,
      })
      .from(treeInvites)
      .where(eq(treeInvites.treeId, id)),
    db.query.trees.findFirst({
      columns: { ownerId: true },
      where: (t, { eq: e }) => e(t.id, id),
    }),
  ]);

  // Surface the owner explicitly (they aren't a member row).
  const owner = tree
    ? await db.query.users.findFirst({
        where: (u, { eq: e }) => e(u.id, tree.ownerId),
        columns: { id: true, email: true, name: true, imageUrl: true },
      })
    : null;

  return ok({ owner, members, invites, canManage: canManage(access) });
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const access = await getTreeAccess(id, user.id);
  if (!canManage(access)) return error("Forbidden", 403);

  const body = addMemberSchema.parse(await req.json());
  const email = normalizeEmail(body.email);

  // Enforce "up to two admins" (owner counts as one) for new admins.
  if (body.role === "admin") {
    const admins = await countAdmins(id);
    if (admins >= MAX_ADMINS_PER_TREE) {
      return error(`A tree can have at most ${MAX_ADMINS_PER_TREE} admins`, 409);
    }
  }

  const invitee = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${email}`,
  });

  if (invitee) {
    // Don't allow inviting the owner as a member.
    const [member] = await db
      .insert(treeMembers)
      .values({ treeId: id, userId: invitee.id, role: body.role, status: "active" })
      .onConflictDoUpdate({
        target: [treeMembers.treeId, treeMembers.userId],
        set: { role: body.role, status: "active" },
      })
      .returning();
    return ok({ type: "member", member }, { status: 201 });
  }

  // No account yet — store a pending invite to be claimed on signup.
  const [invite] = await db
    .insert(treeInvites)
    .values({ treeId: id, email, role: body.role, invitedBy: user.id })
    .onConflictDoUpdate({
      target: [treeInvites.treeId, treeInvites.email],
      set: { role: body.role },
    })
    .returning();
  return ok({ type: "invite", invite }, { status: 201 });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const access = await getTreeAccess(id, user.id);
  if (!canManage(access)) return error("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  const memberUserId = searchParams.get("userId");
  const inviteId = searchParams.get("inviteId");

  if (memberUserId) {
    await db
      .delete(treeMembers)
      .where(
        and(eq(treeMembers.treeId, id), eq(treeMembers.userId, memberUserId)),
      );
    return ok({ removed: true });
  }
  if (inviteId) {
    await db
      .delete(treeInvites)
      .where(and(eq(treeInvites.treeId, id), eq(treeInvites.id, inviteId)));
    return ok({ removed: true });
  }
  return error("Provide userId or inviteId", 400);
});
