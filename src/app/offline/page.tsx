import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
      <WifiOff className="h-14 w-14 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        It looks like you&apos;ve lost your connection. Reconnect and try again to
        view your family tree.
      </p>
    </main>
  );
}
