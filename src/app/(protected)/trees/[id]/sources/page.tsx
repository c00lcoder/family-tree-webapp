import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookText } from "lucide-react";
import { getCurrentDbUser } from "@/lib/auth";
import { getTreeAccess, getTreeSources } from "@/lib/db/queries";
import { Card, CardContent } from "@/components/ui/card";

const EVENT_LABELS: Record<string, string> = {
  BIRT: "Birth",
  DEAT: "Death",
  MARR: "Marriage",
  DIV: "Divorce",
  BURI: "Burial",
  CHR: "Christening",
  BAPM: "Baptism",
};

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentDbUser();
  if (!user) notFound();
  const access = await getTreeAccess(id, user.id);
  if (!access) notFound();

  const sources = await getTreeSources(id);

  return (
    <div>
      <Link
        href={`/trees/${id}`}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
        Back to tree
      </Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
        <BookText className="h-7 w-7 text-primary" aria-hidden />
        Sources
      </h1>
      <p className="mt-1 text-muted-foreground">
        {sources.length} source{sources.length === 1 ? "" : "s"} in this tree.
      </p>

      {sources.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-10 text-center text-muted-foreground">
            No sources yet. Sources come from your GEDCOM&apos;s citation records
            (e.g. census and vital records from Ancestry or FamilySearch).
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-4">
          {sources.map((s) => (
            <li key={s.id}>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-lg font-bold">
                      {s.title ?? "Untitled source"}
                    </h2>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {s.references.length} reference
                      {s.references.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {s.author ? <p>Author: {s.author}</p> : null}
                    {s.publication ? <p>Publication: {s.publication}</p> : null}
                    {s.repositoryName ? (
                      <p>Repository: {s.repositoryName}</p>
                    ) : null}
                  </div>
                  {s.references.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                      {s.references.slice(0, 12).map((r, i) => (
                        <li key={i}>
                          {r.eventType
                            ? (EVENT_LABELS[r.eventType] ?? r.eventType)
                            : "Record"}
                          {r.personName ? ` — ${r.personName}` : ""}
                          {r.page ? ` (${r.page})` : ""}
                        </li>
                      ))}
                      {s.references.length > 12 ? (
                        <li>…and {s.references.length - 12} more</li>
                      ) : null}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
