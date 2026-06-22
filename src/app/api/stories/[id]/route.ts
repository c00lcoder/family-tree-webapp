import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { canManage, getTreeAccess } from "@/lib/db/queries";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;

  const story = await db.query.stories.findFirst({
    where: eq(stories.id, id),
  });
  if (!story) return error("Not found", 404);

  const access = await getTreeAccess(story.treeId, user.id);
  // Authors can delete their own; admins/owner can delete any.
  if (story.authorId !== user.id && !canManage(access)) {
    return error("Forbidden", 403);
  }

  await db.delete(stories).where(eq(stories.id, id));
  return ok({ deleted: true });
});
