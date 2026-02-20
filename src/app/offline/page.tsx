import Link from "next/link";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">You are offline</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Internet is required to load up-to-date employee and attendance data.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Reconnect to the internet, then retry.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Retry
        </Link>
      </div>
    </main>
  );
}
