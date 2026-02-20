"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useSession } from "@/hooks/use-session";

export default function NotFound() {
  const { session, loading } = useSession();

  const userRole = session?.user?.role?.toLowerCase();
  const dashboardHref = userRole ? `/${userRole}/dashboard` : "/sign-in";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-primary">
        <AlertCircle className="h-8 w-8" aria-hidden />
      </div>
      <h1 className="mt-6 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or was moved. Try
        going back to dashboard or check your navigation links.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild disabled={loading}>
          <Link href={dashboardHref}>
            {loading ? "Loading..." : "Go to dashboard"}
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
