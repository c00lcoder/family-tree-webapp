import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trees } from "@/lib/db/schema";
import { getCurrentDbUser } from "@/lib/auth";
import { canEdit, getTreeAccess } from "@/lib/db/queries";
import { TreeView } from "@/components/tree/tree-view";

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
      <h1 className="text-2xl font-extrabold sm:text-3xl">{tree.name}</h1>
      {tree.description ? (
        <p className="mt-1 text-muted-foreground">{tree.description}</p>
      ) : null}
      <div className="mt-6">
        <TreeView treeId={id} canEdit={canEdit(access)} />
      </div>
    </div>
  );
}
