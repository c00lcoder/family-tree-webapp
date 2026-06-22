import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { persons, media } from "@/lib/db/schema";
import { canEdit, getTreeAccess } from "@/lib/db/queries";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { createPersonSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const access = await getTreeAccess(id, user.id);
  if (!access) return error("Not found", 404);

  const rows = await db
    .select({
      person: persons,
      storageKey: media.storageKey,
    })
    .from(persons)
    .leftJoin(media, eq(persons.avatarMediaId, media.id))
    .where(eq(persons.treeId, id));

  // Presign avatar URLs so the editor can preview the photo (skip if storage
  // isn't configured).
  let storage: ReturnType<typeof getStorage> | null = null;
  try {
    storage = getStorage();
  } catch {
    storage = null;
  }
  const result = await Promise.all(
    rows.map(async (r) => ({
      ...r.person,
      avatarUrl:
        storage && r.storageKey
          ? await storage.createDownloadUrl(r.storageKey, 6 * 3600)
          : null,
    })),
  );
  return ok(result);
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
