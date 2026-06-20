import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentDbUser } from "@/lib/auth";
import { canEdit, getTreeAccess } from "@/lib/db/queries";
import { ImportForm } from "./import-form";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentDbUser();
  if (!user) notFound();
  const access = await getTreeAccess(id, user.id);
  if (!canEdit(access)) notFound();

  return (
    <div>
      <Link
        href={`/trees/${id}`}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
        Back to tree
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">
        Import a family tree
      </h1>
      <p className="mt-1 text-muted-foreground">
        Upload a GEDCOM file to add its people and relationships to this tree.
      </p>
      <div className="mt-6">
        <ImportForm treeId={id} />
      </div>
    </div>
  );
}
