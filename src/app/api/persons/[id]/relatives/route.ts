import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { persons } from "@/lib/db/schema";
import { addRelative, canEdit, getTreeAccess } from "@/lib/db/queries";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { addRelativeSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;

  const person = await db.query.persons.findFirst({
    where: eq(persons.id, id),
  });
  if (!person) return error("Not found", 404);

  const access = await getTreeAccess(person.treeId, user.id);
  if (!canEdit(access)) return error("Forbidden", 403);

  const body = addRelativeSchema.parse(await req.json());
  const created = await addRelative(person.treeId, id, body.relationship, {
    givenName: body.givenName,
    surname: body.surname,
    suffix: body.suffix,
  });

  return ok(created, { status: 201 });
});
