"use client";

import { Loader2, Search, ShieldCheck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function UsersLoadingCard({ delay = 0 }: { delay?: number }) {
  return (
    <Card
      className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full bg-primary/10" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-3 w-4/5 rounded-full" />
          <Skeleton className="h-3 w-2/3 rounded-full" />
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Skeleton className="h-6 w-20 rounded-full" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-16 rounded-md" />
            <Skeleton className="h-9 w-16 rounded-md bg-primary/15" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function UsersLoadingSection({
  title,
  caption,
  accent = "default",
  cardCount,
}: {
  title: string;
  caption: string;
  accent?: "default" | "danger";
  cardCount: number;
}) {
  const titleClass =
    accent === "danger" ? "text-destructive" : "text-foreground";

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {caption}
          </p>
          <h2 className={`text-2xl font-semibold ${titleClass}`}>{title}</h2>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Skeleton className="h-7 w-24 rounded-full" />
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Skeleton className="h-10 w-full rounded-full pl-10" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4">
        {Array.from({ length: cardCount }).map((_, index) => (
          <UsersLoadingCard key={`${title}-${index}`} delay={index * 90} />
        ))}
      </div>
    </section>
  );
}

export function UsersLoadingState() {
  return (
    <div className="px-4 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Syncing account directory
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pulling account roles, employee links, and status groups.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Account coverage</p>
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-28 rounded-full" />
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      <UsersLoadingSection title="Management" caption="Role Group" cardCount={3} />
      <UsersLoadingSection title="Employee" caption="Role Group" cardCount={4} />
      <UsersLoadingSection
        title="Disabled Accounts"
        caption="Status"
        accent="danger"
        cardCount={2}
      />
    </div>
  );
}
