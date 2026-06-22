import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { persons } from "@/lib/db/schema";
import { getPersonSources, getTreeAccess } from "@/lib/db/queries";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";

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

  return ok(await getPersonSources(id));
});
