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

  // Avatar values are storage keys. The graph response is already access-checked
  // above, so we hand back short-lived presigned GET URLs the browser can load
  // directly from R2 (bucket stays private; no public access needed).
  let storage: ReturnType<typeof getStorage> | null = null;
  try {
    storage = getStorage();
  } catch {
    storage = null;
  }
  if (storage) {
    await Promise.all(
      data.map(async (datum) => {
        if (datum.data.avatar) {
          datum.data.avatar = await storage!.createDownloadUrl(
            datum.data.avatar,
            6 * 3600,
          );
        }
      }),
    );
  }

  return ok(data);
});
