import Link from "next/link";
import { Logo } from "@/components/logo";
import { getCurrentDbUser } from "@/lib/auth";
import { listTreesForUser } from "@/lib/db/queries";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { CreateTreeButton } from "@/components/trees/create-tree-button";

export default async function TreesPage() {
  const user = await getCurrentDbUser();
  const trees = user ? await listTreesForUser(user.id) : [];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Your trees</h1>
        <CreateTreeButton />
      </div>

      {trees.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Logo className="h-12 w-12" />
            <p className="text-lg text-muted-foreground">
              You don&apos;t have any trees yet.
            </p>
            <CreateTreeButton />
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {trees.map((tree) => (
            <li key={tree.id}>
              <Link href={`/trees/${tree.id}`} className="block">
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="py-5">
                    <CardTitle>{tree.name}</CardTitle>
                    {tree.description ? (
                      <p className="mt-1 line-clamp-2 text-muted-foreground">
                        {tree.description}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
