import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleAlert,
  Clock3,
  Coins,
  FileText,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/rbac";
import {
  loadRoleDashboardData,
  type DashboardAction,
  type DashboardData,
  type DashboardIconKey,
  type DashboardItem,
  type DashboardPanel,
  type DashboardStat,
} from "./dashboard-data";

const iconMap: Record<DashboardIconKey, typeof Activity> = {
  activity: Activity,
  alert: CircleAlert,
  banknote: Banknote,
  briefcase: BriefcaseBusiness,
  building: Building2,
  calendar: CalendarDays,
  clock: Clock3,
  coins: Coins,
  file: FileText,
  receipt: ReceiptText,
  scan: QrCode,
  shield: ShieldCheck,
  sparkles: Sparkles,
  users: Users,
};

const toneIconClass = (tone: DashboardStat["tone"]) => {
  switch (tone) {
    case "success":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "warning":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "danger":
      return "bg-destructive/10 text-destructive";
    case "info":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
    default:
      return "bg-primary/10 text-primary";
  }
};

const toneBorderClass = (tone: DashboardStat["tone"]) => {
  switch (tone) {
    case "success":
      return "border-emerald-500/20";
    case "warning":
      return "border-amber-500/20";
    case "danger":
      return "border-destructive/20";
    case "info":
      return "border-sky-500/20";
    default:
      return "border-primary/20";
  }
};

const heroGreeting = () => {
  const hour = Number(
    new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const getGreetingName = (displayName: string) =>
  displayName.trim().split(/\s+/)[0] || displayName;

const normalizeHref = (href?: string) => (href ? href.split("?")[0] : null);

const getVisibleActions = (data: DashboardData) => {
  const blockedHrefs = new Set(
    [data.primaryPanel.footerHref, data.secondaryPanel.footerHref]
      .map(normalizeHref)
      .filter(Boolean),
  );

  return data.actions
    .filter((action) => !blockedHrefs.has(normalizeHref(action.href)))
    .slice(0, 3);
};

const DashboardStatCard = ({ stat }: { stat: DashboardStat }) => {
  const Icon = iconMap[stat.icon];

  return (
    <Card
      className={cn(
        "rounded-2xl border bg-card/70 shadow-sm backdrop-blur-sm",
        toneBorderClass(stat.tone),
      )}
    >
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
          <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
          <p className="text-sm text-muted-foreground">{stat.description}</p>
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
            toneIconClass(stat.tone),
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
};

const ActionCard = ({ action }: { action: DashboardAction }) => {
  const Icon = iconMap[action.icon];

  return (
    <Link href={action.href} className="group block">
      <Card className="h-full rounded-2xl border border-border/70 bg-card/70 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card">
        <CardContent className="flex h-full flex-col justify-between gap-5 p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              {action.badge ? (
                <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                  {action.badge}
                </Badge>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold">{action.title}</h3>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            Open
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const PanelItem = ({ item }: { item: DashboardItem }) => {
  const Icon = iconMap[item.icon];

  const content = (
    <div className="flex items-start gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 transition duration-200 hover:border-primary/25 hover:bg-background">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted/60 text-foreground">
        <Icon className="h-4.5 w-4.5" />
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {item.value ? (
              <span className="font-mono text-sm font-semibold tabular-nums">
                {item.value}
              </span>
            ) : null}
            {item.statusLabel ? (
              <Badge variant="outline" className={item.statusClassName}>
                {item.statusLabel}
              </Badge>
            ) : null}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{item.meta}</p>
      </div>
    </div>
  );

  if (!item.href) return content;

  return (
    <Link href={item.href} className="block">
      {content}
    </Link>
  );
};

const DashboardPanelCard = ({ panel }: { panel: DashboardPanel }) => (
  <Card className="rounded-[28px] border border-border/70 bg-card/80 shadow-sm">
    <CardHeader className="border-b border-border/60 pb-5">
      <CardTitle className="text-lg">{panel.title}</CardTitle>
      <CardDescription>{panel.description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 pt-6">
      {panel.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
          {panel.emptyText}
        </div>
      ) : (
        panel.items.map((item) => <PanelItem key={item.id} item={item} />)
      )}

      {panel.footerHref && panel.footerLabel ? (
        <Link
          href={panel.footerHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          {panel.footerLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </CardContent>
  </Card>
);

const DashboardHero = ({ data }: { data: DashboardData }) => (
  <section className="space-y-5">
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
        {data.roleLabel}
      </Badge>
      <p className="text-sm text-muted-foreground">{data.timestampLabel}</p>
    </div>

    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">
          {heroGreeting()},
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {getGreetingName(data.displayName)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {data.displayName}
          {data.subtitle ? ` • ${data.subtitle}` : ""}
        </p>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        {data.summary}
      </p>
    </div>

    <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-border/60 pt-4">
      {data.notes.slice(0, 3).map((note) => (
        <div key={note} className="flex min-w-[16rem] items-start gap-3">
          <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary/70" />
          <p className="text-sm leading-6 text-muted-foreground">{note}</p>
        </div>
      ))}
    </div>
  </section>
);

export default async function RoleDashboardPage({
  role,
}: {
  role: AppRole;
}) {
  const data = await loadRoleDashboardData(role);
  const visibleActions = data ? getVisibleActions(data) : [];

  if (!data) {
    return (
      <div className="px-4 py-8 sm:px-8 lg:px-12">
        <Card className="rounded-2xl border border-destructive/20 bg-destructive/5">
          <CardContent className="p-6 text-sm text-destructive">
            Dashboard data is unavailable for the current session.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-4 py-8 sm:px-8 lg:px-12">
      <DashboardHero data={data} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.stats.map((stat) => (
          <DashboardStatCard key={stat.label} stat={stat} />
        ))}
      </section>

      {visibleActions.length > 0 ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Shortcuts</h2>
            <p className="text-sm text-muted-foreground">
              Direct links that are not already covered by the boards below.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleActions.map((action) => (
              <ActionCard key={action.href} action={action} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <DashboardPanelCard panel={data.primaryPanel} />
        <DashboardPanelCard panel={data.secondaryPanel} />
      </section>
    </div>
  );
}
