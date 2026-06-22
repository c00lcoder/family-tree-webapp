import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { canEdit, getTreeAccess } from "@/lib/db/queries";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { createMediaSchema } from "@/lib/validation";

export const runtime = "nodejs";

export const POST = handle(async (req: Request) => {
  const user = await requireDbUser();
  const body = createMediaSchema.parse(await req.json());

  const access = await getTreeAccess(body.treeId, user.id);
  if (!canEdit(access)) return error("Forbidden", 403);

  const [row] = await db
    .insert(media)
    .values({
      treeId: body.treeId,
      personId: body.personId ?? null,
      storageKey: body.storageKey,
      mimeType: body.mimeType,
      caption: body.caption ?? null,
      width: body.width ?? null,
      height: body.height ?? null,
      uploadedBy: user.id,
    })
    .returning();

  let url: string | null = null;
  try {
    url = await getStorage().createDownloadUrl(row.storageKey);
  } catch {
    url = null;
  }

  return ok({ ...row, url }, { status: 201 });
});
