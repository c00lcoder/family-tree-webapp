import { randomUUID } from "node:crypto";
import { canEdit, getTreeAccess } from "@/lib/db/queries";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { uploadUrlSchema } from "@/lib/validation";

export const runtime = "nodejs";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export const POST = handle(async (req: Request) => {
  const user = await requireDbUser();
  const body = uploadUrlSchema.parse(await req.json());

  const access = await getTreeAccess(body.treeId, user.id);
  if (!canEdit(access)) return error("Forbidden", 403);

  const ext = EXT[body.contentType] ?? "bin";
  const key = `trees/${body.treeId}/${randomUUID()}.${ext}`;

  const storage = getStorage();
  const uploadUrl = await storage.createUploadUrl({
    key,
    contentType: body.contentType,
  });

  return ok({ uploadUrl, key, publicUrl: storage.getPublicUrl(key) });
});
