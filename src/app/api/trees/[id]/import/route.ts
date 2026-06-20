import { canEdit, getTreeAccess } from "@/lib/db/queries";
import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { importGedcom } from "@/lib/gedcom/import";

export const runtime = "nodejs";
// GEDCOM files can be large; allow a longer execution window.
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const access = await getTreeAccess(id, user.id);
  if (!canEdit(access)) return error("Forbidden", 403);

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return error("Missing 'file' upload", 400);
  }
  if (file.size > MAX_BYTES) {
    return error("File too large (max 20 MB)", 413);
  }

  const text = await file.text();
  const result = await importGedcom(id, text);
  return ok(result, { status: 201 });
});
