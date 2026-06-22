import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { canEdit, getTreeAccess } from "@/lib/db/queries";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;

  const row = await db.query.media.findFirst({ where: eq(media.id, id) });
  if (!row) return error("Not found", 404);

  const access = await getTreeAccess(row.treeId, user.id);
  if (!canEdit(access)) return error("Forbidden", 403);

  // Best-effort remove the object; deleting the row nulls any person.avatarMediaId
  // that referenced it (FK onDelete: set null).
  try {
    await getStorage().delete(row.storageKey);
  } catch {
    // Ignore storage errors so the DB stays consistent.
  }
  await db.delete(media).where(eq(media.id, id));

  return ok({ deleted: true });
});
