import Image from "next/image";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function LoadingDots() {
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-2.5 w-2.5 rounded-full bg-primary/30 animate-pulse"
          style={{
            animationDelay: `${index * 220}ms`,
            animationDuration: "1s",
          }}
        />
      ))}
    </div>
  );
}

function CrabLoader({
  title,
  description,
  imageSize = 88,
  className,
}: {
  title: string;
  description: string;
  imageSize?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-sm text-center", className)}>
      <div className="mx-auto w-fit animate-bounce">
        <Image
          src="/logo-icon.png"
          alt="JumboCrab loading"
          width={imageSize}
          height={imageSize}
          className="object-contain"
          priority
        />
      </div>
      <p className="mt-5 text-xl font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <LoadingDots />
      <p className="mt-3 text-xs text-muted-foreground">Please wait a moment.</p>
    </div>
  );
}

export function InlineLoadingState({
  label = "Loading data",
  className,
}: {
  label?: string;
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-white p-5 dark:bg-background",
        className,
      )}
    >
      <div className="flex min-h-[9rem] flex-col items-center justify-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Spinner className="h-5 w-5" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Syncing module data and preparing the next view.
        </p>
        <LoadingDots />
      </div>
    </div>
  );
}

export function TableLoadingState({
  label = "Loading records",
}: {
  label?: string;
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-5 dark:bg-background">
      <div className="flex min-h-[14rem] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Spinner className="h-6 w-6" />
        </div>
        <p className="mt-4 text-lg font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Refreshing rows and rebuilding the latest results.
        </p>
        <LoadingDots />
      </div>
    </div>
  );
}

export function ModuleLoadingState(props: {
  title: string;
  description: string;
  cardCount?: number;
}) {
  const { title, description } = props;

  return (
    <div className="bg-white px-4 py-8 dark:bg-background sm:px-8 lg:px-12">
      <div className="flex min-h-[60vh] items-center justify-center">
        <CrabLoader title={title} description={description} imageSize={96} />
      </div>
    </div>
  );
}

export function AppHeaderLoadingState() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center border-b bg-background">
      <div className="flex h-full w-full items-center justify-between px-4">
        <div className="text-sm text-muted-foreground">Loading header...</div>
        <LoadingDots />
      </div>
    </header>
  );
}

export function AppSidebarLoadingState() {
  return (
    <div className="hidden h-full border-r bg-sidebar md:flex md:w-64 md:flex-col md:items-center md:justify-center px-6">
      <CrabLoader
        title="Loading navigation"
        description="Preparing menu items and access."
        imageSize={72}
      />
    </div>
  );
}

export function FullScreenLoadingState({
  title = "Loading",
  description = "Preparing the next screen and syncing your session.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-background">
      <div className="flex h-full items-center justify-center px-6">
        <CrabLoader title={title} description={description} imageSize={104} />
      </div>
    </div>
  );
}

export function ScreenOverlayLoadingState({
  title = "Loading",
  description = "Preparing the next screen and syncing your session.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="absolute inset-0 z-20 rounded-[2rem] bg-white dark:bg-background">
      <div className="flex h-full items-center justify-center px-6">
        <CrabLoader title={title} description={description} imageSize={88} />
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
      <InlineLoadingState label={label} className="h-full" />
    </div>
  );
}
