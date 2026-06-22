import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { persons, stories } from "@/lib/db/schema";
import {
  canEdit,
  canManage,
  getPersonStories,
  getTreeAccess,
} from "@/lib/db/queries";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { createStorySchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;

  const person = await db.query.persons.findFirst({
    where: eq(persons.id, id),
  });
  if (!person) return error("Not found", 404);
  const access = await getTreeAccess(person.treeId, user.id);
  if (!access) return error("Not found", 404);

  const rows = await getPersonStories(id);
  const manage = canManage(access);
  return ok(
    rows.map((s) => ({
      ...s,
      canDelete: manage || s.authorId === user.id,
    })),
  );
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;

  const person = await db.query.persons.findFirst({
    where: eq(persons.id, id),
  });
  if (!person) return error("Not found", 404);
  const access = await getTreeAccess(person.treeId, user.id);
  if (!canEdit(access)) return error("Forbidden", 403);

  const body = createStorySchema.parse(await req.json());
  const [story] = await db
    .insert(stories)
    .values({
      treeId: person.treeId,
      personId: id,
      authorId: user.id,
      title: body.title ?? null,
      body: body.body,
    })
    .returning();
  return ok(story, { status: 201 });
});
