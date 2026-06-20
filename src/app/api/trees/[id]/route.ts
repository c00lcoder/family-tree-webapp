import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trees } from "@/lib/db/schema";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { canManage, getTreeAccess } from "@/lib/db/queries";
import { updateTreeSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const access = await getTreeAccess(id, user.id);
  if (!access) return error("Not found", 404);
  const tree = await db.query.trees.findFirst({ where: eq(trees.id, id) });
  return ok({ ...tree, access });
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const access = await getTreeAccess(id, user.id);
  if (!canManage(access)) return error("Forbidden", 403);

  const body = updateTreeSchema.parse(await req.json());
  const [updated] = await db
    .update(trees)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(trees.id, id))
    .returning();
  return ok(updated);
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const access = await getTreeAccess(id, user.id);
  // Only the owner may delete an entire tree.
  if (access !== "owner") return error("Forbidden", 403);
  await db.delete(trees).where(eq(trees.id, id));
  return ok({ deleted: true });
});
