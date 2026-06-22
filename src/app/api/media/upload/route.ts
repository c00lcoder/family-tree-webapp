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

/**
 * Build a tidy, namespaced storage key so the bucket stays organized:
 *
 *   trees/<treeId>/persons/<personId>/avatar-<uuid>.<ext>   (person avatar)
 *   trees/<treeId>/persons/<personId>/<uuid>.<ext>          (other person photo)
 *   trees/<treeId>/media/<uuid>.<ext>                       (tree-level media)
 */
function buildKey(opts: {
  treeId: string;
  personId?: string;
  category: "avatar" | "photo";
  ext: string;
}): string {
  const id = randomUUID();
  if (opts.personId) {
    const prefix = opts.category === "avatar" ? "avatar-" : "";
    return `trees/${opts.treeId}/persons/${opts.personId}/${prefix}${id}.${opts.ext}`;
  }
  return `trees/${opts.treeId}/media/${id}.${opts.ext}`;
}

export const POST = handle(async (req: Request) => {
  const user = await requireDbUser();
  const body = uploadUrlSchema.parse(await req.json());

  const access = await getTreeAccess(body.treeId, user.id);
  if (!canEdit(access)) return error("Forbidden", 403);

  const ext = EXT[body.contentType] ?? "bin";
  const key = buildKey({
    treeId: body.treeId,
    personId: body.personId,
    category: body.category,
    ext,
  });

  const storage = getStorage();
  const uploadUrl = await storage.createUploadUrl({
    key,
    contentType: body.contentType,
  });

  return ok({ uploadUrl, key, publicUrl: storage.getPublicUrl(key) });
});
