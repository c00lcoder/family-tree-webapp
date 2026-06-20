import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { persons } from "@/lib/db/schema";
import { canEdit, getTreeAccess } from "@/lib/db/queries";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { createPersonSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const access = await getTreeAccess(id, user.id);
  if (!access) return error("Not found", 404);
  const rows = await db.select().from(persons).where(eq(persons.treeId, id));
  return ok(rows);
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const access = await getTreeAccess(id, user.id);
  if (!canEdit(access)) return error("Forbidden", 403);

  const body = createPersonSchema.parse(await req.json());
  const [person] = await db
    .insert(persons)
    .values({
      treeId: id,
      givenName: body.givenName ?? null,
      surname: body.surname ?? null,
      sex: body.sex,
      notes: body.notes ?? null,
    })
    .returning();
  return ok(person, { status: 201 });
});
