import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { getCurrentDbUser } from "@/lib/auth";
import { getTreeAccess, getTreePlaces } from "@/lib/db/queries";
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

export default async function PlacesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentDbUser();
  if (!user) notFound();
  const access = await getTreeAccess(id, user.id);
  if (!access) notFound();

  const places = await getTreePlaces(id);

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
        <MapPin className="h-7 w-7 text-primary" aria-hidden />
        Places
      </h1>
      <p className="mt-1 text-muted-foreground">
        {places.length} place{places.length === 1 ? "" : "s"} across this tree.
      </p>

      {places.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-10 text-center text-muted-foreground">
            No places recorded yet. Places come from event locations in your
            GEDCOM, or you can add them when editing events.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-4">
          {places.map((p) => (
            <li key={p.place}>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-lg font-bold">{p.place}</h2>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {p.count} event{p.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {p.events.slice(0, 12).map((e, i) => (
                      <li key={i}>
                        {EVENT_LABELS[e.type] ?? e.type}
                        {e.personName ? ` — ${e.personName}` : ""}
                        {e.dateRaw ? ` (${e.dateRaw})` : ""}
                      </li>
                    ))}
                    {p.events.length > 12 ? (
                      <li>…and {p.events.length - 12} more</li>
                    ) : null}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
