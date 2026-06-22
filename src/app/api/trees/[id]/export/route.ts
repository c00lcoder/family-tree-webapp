import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trees } from "@/lib/db/schema";
import { error, handle } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { getTreeAccess, getTreeExportData } from "@/lib/db/queries";
import { exportGedcom } from "@/lib/gedcom/export";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireDbUser();
  const { id } = await ctx.params;

  const access = await getTreeAccess(id, user.id);
  if (!access) return error("Not found", 404);

  const tree = await db.query.trees.findFirst({ where: eq(trees.id, id) });
  const { personRows, familyRows, childRows, eventRows } =
    await getTreeExportData(id);

  const gedcom = exportGedcom({
    persons: personRows,
    families: familyRows,
    children: childRows,
    events: eventRows,
  });

  const safeName = (tree?.name ?? "family-tree")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return new Response(gedcom, {
    status: 200,
    headers: {
      "Content-Type": "application/x-gedcom; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName || "family-tree"}.ged"`,
    },
  });
});
