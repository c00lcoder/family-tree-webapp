import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { persons } from "@/lib/db/schema";
import { canEdit, getTreeAccess } from "@/lib/db/queries";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { updatePersonSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function loadPersonWithAccess(personId: string, userId: string) {
  const person = await db.query.persons.findFirst({
    where: eq(persons.id, personId),
  });
  if (!person) return { person: null, access: null };
  const access = await getTreeAccess(person.treeId, userId);
  return { person, access };
}

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const { person, access } = await loadPersonWithAccess(id, user.id);
  if (!person) return error("Not found", 404);
  if (!canEdit(access)) return error("Forbidden", 403);

  const body = updatePersonSchema.parse(await req.json());
  const [updated] = await db
    .update(persons)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(persons.id, id))
    .returning();
  return ok(updated);
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const { person, access } = await loadPersonWithAccess(id, user.id);
  if (!person) return error("Not found", 404);
  if (!canEdit(access)) return error("Forbidden", 403);
  await db.delete(persons).where(eq(persons.id, id));
  return ok({ deleted: true });
});
