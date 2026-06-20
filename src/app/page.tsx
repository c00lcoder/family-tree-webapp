import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { TreePine, Upload, Users, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();
  const signedIn = Boolean(userId);
  return (
    <main className="flex flex-1 flex-col items-center px-5 py-12">
      <section className="flex w-full max-w-2xl flex-col items-center text-center">
        <TreePine className="h-16 w-16 text-primary" aria-hidden />
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Your family tree, made simple
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          View, edit and import family trees from any GEDCOM file. Big, clear and
          easy to use on any device — free and open source.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {signedIn ? (
            <Link href="/trees" className="w-full sm:w-auto">
              <Button size="lg" className="w-full">
                Go to my trees
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/sign-up" className="w-full sm:w-auto">
                <Button size="lg" className="w-full">
                  Get started
                </Button>
              </Link>
              <Link href="/sign-in" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full">
                  Sign in
                </Button>
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="mt-16 grid w-full max-w-3xl gap-5 sm:grid-cols-3">
        <Feature
          icon={<Upload className="h-7 w-7" aria-hidden />}
          title="Import GEDCOM"
          body="Bring your tree from Ancestry, FamilySearch, Gramps and more."
        />
        <Feature
          icon={<Users className="h-7 w-7" aria-hidden />}
          title="Share with family"
          body="Invite relatives to view and edit, with up to two admins."
        />
        <Feature
          icon={<Smartphone className="h-7 w-7" aria-hidden />}
          title="Works everywhere"
          body="Installable on your phone, fast and accessible by design."
        />
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 text-left">
      <div className="text-primary">{icon}</div>
      <h2 className="mt-3 text-lg font-bold">{title}</h2>
      <p className="mt-1 text-muted-foreground">{body}</p>
    </div>
  );
}
