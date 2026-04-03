import { Loader2, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function InlineLoadingState({
  label = "Loading data",
  lines = 2,
  className,
}: {
  label?: string;
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm",
        className,
      )}
    >
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">
              Syncing module data and preparing the next view.
            </p>
          </div>
          <div className="space-y-2">
            {Array.from({ length: lines }).map((_, index) => (
              <Skeleton
                key={`${label}-${index}`}
                className={cn(
                  "h-3 rounded-full",
                  index === lines - 1 ? "w-2/3" : "w-full",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TableLoadingState({
  label = "Loading records",
  columns = 5,
  rows = 4,
}: {
  label?: string;
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm">
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            Building rows, filters, and summary data.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div
          className="grid gap-3 rounded-xl border border-border/60 bg-background/60 p-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={`head-${index}`} className="h-3 w-3/4 rounded-full" />
          ))}
        </div>

        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid gap-3 rounded-xl border border-border/50 bg-background/50 p-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${columnIndex}`}
                className={cn(
                  "h-3 rounded-full",
                  columnIndex === columns - 1 ? "w-1/2" : "w-5/6",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ModuleLoadingState({
  title,
  description,
  cardCount = 3,
}: {
  title: string;
  description: string;
  cardCount?: number;
}) {
  return (
    <div className="px-4 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Preparing module
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Live sync</p>
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-28 rounded-full" />
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Overview
            </p>
            <h2 className="text-2xl font-semibold">{title}</h2>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Skeleton className="h-7 w-24 rounded-full" />
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Skeleton className="h-10 w-full rounded-full" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4">
          {Array.from({ length: cardCount }).map((_, index) => (
            <div
              key={`${title}-${index}`}
              className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32 rounded-full" />
                      <Skeleton className="h-3 w-20 rounded-full" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full rounded-full" />
                  <Skeleton className="h-3 w-4/5 rounded-full" />
                  <Skeleton className="h-3 w-3/5 rounded-full" />
                </div>
                <div className="flex justify-end gap-2">
                  <Skeleton className="h-9 w-16 rounded-md" />
                  <Skeleton className="h-9 w-16 rounded-md bg-primary/15" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AppHeaderLoadingState() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-full w-full items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-6 w-px rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-40 rounded-full" />
            <Skeleton className="h-3 w-24 rounded-full" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary md:flex">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Syncing session
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    </header>
  );
}

export function AppSidebarLoadingState() {
  return (
    <div className="hidden h-full border-r bg-sidebar md:flex md:w-64 md:flex-col">
      <div className="border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-3 w-32 rounded-full" />
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 px-3 py-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={`sidebar-item-${index}`}
            className="flex items-center gap-3 rounded-xl px-3 py-2"
          >
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-3 w-28 rounded-full" />
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-3 w-32 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DynamicBlockLoadingState({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("min-h-[220px]", className)}>
      <InlineLoadingState label={label} lines={3} className="h-full" />
    </div>
  );
}
