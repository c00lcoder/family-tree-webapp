import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { treeMembers, users } from "@/lib/db/schema";
import {
  MAX_ADMINS_PER_TREE,
  canManage,
  countAdmins,
  getTreeAccess,
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

  const rows = await db
    .select({
      id: treeMembers.id,
      role: treeMembers.role,
      status: treeMembers.status,
      userId: users.id,
      email: users.email,
      name: users.name,
      imageUrl: users.imageUrl,
    })
    .from(treeMembers)
    .innerJoin(users, eq(treeMembers.userId, users.id))
    .where(eq(treeMembers.treeId, id));
  return ok(rows);
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const access = await getTreeAccess(id, user.id);
  if (!canManage(access)) return error("Forbidden", 403);

  const body = addMemberSchema.parse(await req.json());

  const invitee = await db.query.users.findFirst({
    where: eq(users.email, body.email),
  });
  if (!invitee) {
    return error("No user with that email has signed up yet", 404);
  }

  // Enforce the "up to two admins" rule (owner counts as one).
  if (body.role === "admin") {
    const admins = await countAdmins(id);
    const alreadyAdmin = await db.query.treeMembers.findFirst({
      where: and(
        eq(treeMembers.treeId, id),
        eq(treeMembers.userId, invitee.id),
        eq(treeMembers.role, "admin"),
      ),
    });
    if (!alreadyAdmin && admins >= MAX_ADMINS_PER_TREE) {
      return error(
        `A tree can have at most ${MAX_ADMINS_PER_TREE} admins`,
        409,
      );
    }
  }

  const [member] = await db
    .insert(treeMembers)
    .values({
      treeId: id,
      userId: invitee.id,
      role: body.role,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [treeMembers.treeId, treeMembers.userId],
      set: { role: body.role, status: "active" },
    })
    .returning();
  return ok(member, { status: 201 });
});
