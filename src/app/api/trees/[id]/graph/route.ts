import { error, handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { getTreeAccess, getTreeGraph } from "@/lib/db/queries";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;
  const access = await getTreeAccess(id, user.id);
  if (!access) return error("Not found", 404);

  const data = await getTreeGraph(id);

  // Resolve avatar storage keys to public URLs (best effort — skip if storage
  // isn't configured so the graph still renders without photos).
  let toUrl: ((key: string) => string) | null = null;
  try {
    const storage = getStorage();
    toUrl = (key) => storage.getPublicUrl(key);
  } catch {
    toUrl = null;
  }
  if (toUrl) {
    for (const datum of data) {
      if (datum.data.avatar) datum.data.avatar = toUrl(datum.data.avatar);
    }
  }

  return ok(data);
});
