import Link from "next/link";
import { redirect } from "next/navigation";
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
  type DashboardChart,
  type DashboardData,
  type DashboardIconKey,
  type DashboardItem,
  type DashboardPanel,
  type DashboardStat,
} from "./dashboard-data";
import DashboardAttendanceChart from "./dashboard-attendance-chart";

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
        "rounded-2xl border bg-card/70 shadow-sm",
        toneBorderClass(stat.tone),
      )}
    >
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {stat.label}
          </p>
          <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
          <p className="text-xs text-muted-foreground">{stat.description}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            toneIconClass(stat.tone),
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </CardContent>
    </Card>
  );
};

const QuickActionRow = ({ action }: { action: DashboardAction }) => {
  const Icon = iconMap[action.icon];

  return (
    <Link href={action.href} className="group block">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/80 p-3 transition-colors hover:border-primary/30 hover:bg-background">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{action.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {action.description}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action.badge ? (
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/5 text-primary"
            >
              {action.badge}
            </Badge>
          ) : null}
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
};

const PanelItem = ({ item }: { item: DashboardItem }) => {
  const Icon = iconMap[item.icon];

  const content = (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-3 transition duration-200 hover:border-primary/25 hover:bg-background">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-foreground">
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
  <Card className="rounded-2xl border border-border/70 bg-card/80 shadow-sm">
    <CardHeader className="border-b border-border/60 pb-4">
      <CardTitle className="text-base">{panel.title}</CardTitle>
      <CardDescription className="text-xs">{panel.description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3 pt-4">
      {panel.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
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
  <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
            {data.roleLabel}
          </Badge>
          <p className="text-sm text-muted-foreground">{data.timestampLabel}</p>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {getGreetingName(data.displayName)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.subtitle || data.displayName}
          </p>
        </div>

        <p className="text-sm text-muted-foreground">{data.summary}</p>
      </div>

      {data.notes.length > 0 ? (
        <div className="flex flex-wrap gap-2 xl:max-w-[34rem] xl:justify-end">
          {data.notes.slice(0, 3).map((note) => (
            <div
              key={note}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs text-muted-foreground"
            >
              <span className="h-2 w-2 rounded-full bg-primary/70" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  </section>
);

const DashboardChartCard = ({ chart }: { chart: DashboardChart }) => (
  <Card className="rounded-2xl border border-border/70 bg-card/80 shadow-sm">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">{chart.title}</CardTitle>
      <CardDescription>{chart.description}</CardDescription>
    </CardHeader>
    <CardContent>
      <DashboardAttendanceChart data={chart.data} />
    </CardContent>
  </Card>
);

const QuickActionsCard = ({ actions }: { actions: DashboardAction[] }) => (
  <Card className="rounded-2xl border border-border/70 bg-card/80 shadow-sm">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Quick Actions</CardTitle>
      <CardDescription>Common routes.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2">
      {actions.map((action) => (
        <QuickActionRow key={action.href} action={action} />
      ))}
    </CardContent>
  </Card>
);

export default async function RoleDashboardPage({
  role,
}: {
  role: AppRole;
}) {
  const data = await loadRoleDashboardData(role);

  if (!data) {
    redirect("/sign-in");
  }

  const visibleActions = getVisibleActions(data);

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <DashboardHero data={data} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.stats.map((stat) => (
          <DashboardStatCard key={stat.label} stat={stat} />
        ))}
      </section>

      {data.chart || visibleActions.length > 0 ? (
        <section
          className={cn(
            "grid gap-4",
            data.chart && visibleActions.length > 0
              ? "xl:grid-cols-[minmax(0,1.45fr)_360px]"
              : undefined,
          )}
        >
          {data.chart ? <DashboardChartCard chart={data.chart} /> : null}
          {visibleActions.length > 0 ? (
            <QuickActionsCard actions={visibleActions} />
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <DashboardPanelCard panel={data.primaryPanel} />
        <DashboardPanelCard panel={data.secondaryPanel} />
      </section>
    </div>
  );
}
