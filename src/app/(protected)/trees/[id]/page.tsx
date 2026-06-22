import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trees } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/auth";
import { canEdit, canManage, getTreeAccess } from "@/lib/db/queries";
import { TreeView } from "@/components/tree/tree-view";
import { TreeActions } from "@/components/trees/tree-actions";
import { TreeShare } from "@/components/trees/tree-share";

export default async function TreePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentDbUser();
  if (!user) notFound();

  const access = await getTreeAccess(id, user.id);
  if (!access) notFound();

  const tree = await db.query.trees.findFirst({ where: eq(trees.id, id) });
  if (!tree) notFound();

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{tree.name}</h1>
          {tree.description ? (
            <p className="mt-1 text-muted-foreground">{tree.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManage(access) && <TreeShare treeId={id} />}
          <TreeActions
            treeId={id}
            name={tree.name}
            description={tree.description}
            canManage={canManage(access)}
            isOwner={access === "owner"}
          />
        </div>
      </div>
      <div className="mt-6">
        <TreeView treeId={id} canEdit={canEdit(access)} />
      </div>
    </div>
  );
}
