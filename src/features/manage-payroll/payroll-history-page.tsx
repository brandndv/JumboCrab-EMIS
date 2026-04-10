"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CircleDollarSign,
  Filter,
  RefreshCcw,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  getPayrollRunDetails,
  listPayrollRuns,
} from "@/actions/payroll/payroll-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InlineLoadingState,
  ModuleLoadingState,
} from "@/components/loading/loading-states";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  PayrollRunDetail,
  PayrollRunSummary,
  PayrollStatusValue,
  PayrollTypeValue,
} from "@/types/payroll";
import {
  decisionClass,
  formatCurrency,
  formatDateTime,
  formatDateRange,
  humanizePayrollType,
  payrollTypeClass,
  statusClass,
} from "./payroll-ui-helpers";
import PayrollRunDetailsCard from "./payroll-run-details-card";

type StatusFilter = "ALL" | PayrollStatusValue;
type TypeFilter = "ALL" | PayrollTypeValue;
type MonthFilter = "ALL" | `${number}`;

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DEFAULT_VISIBLE_MONTHS = 3;
const DEFAULT_EXPANDED_MONTHS = 2;
const DEFAULT_VISIBLE_RUNS_PER_MONTH = 6;
const archiveFilterClass =
  "h-11 rounded-xl border border-orange-200/70 bg-white/90 px-3 text-sm text-foreground shadow-sm transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200";

const isReturnedRun = (run: PayrollRunSummary) =>
  run.managerDecision === "REJECTED" || run.gmDecision === "REJECTED";

const runActivityLabel = (run: PayrollRunSummary) => {
  if (run.releasedAt) return `Released ${formatDateTime(run.releasedAt)}`;
  if (run.gmReviewedAt) return `GM reviewed ${formatDateTime(run.gmReviewedAt)}`;
  if (run.managerReviewedAt) {
    return `Manager reviewed ${formatDateTime(run.managerReviewedAt)}`;
  }
  return `Generated ${formatDateTime(run.generatedAt)}`;
};

const PayrollHistoryPage = () => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [yearFilter, setYearFilter] = useState<"ALL" | `${number}`>("ALL");
  const [monthFilter, setMonthFilter] = useState<MonthFilter>("ALL");
  const [search, setSearch] = useState("");
  const [visibleMonthCount, setVisibleMonthCount] = useState(
    DEFAULT_VISIBLE_MONTHS,
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [visibleRunsByGroup, setVisibleRunsByGroup] = useState<
    Record<string, number>
  >({});

  const [runs, setRuns] = useState<PayrollRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PayrollRunDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listPayrollRuns({ limit: 180 });
      if (!result.success) {
        throw new Error(result.error || "Failed to load payroll history");
      }
      const rows = (result.data ?? []).sort(
        (a, b) =>
          new Date(b.payrollPeriodStart).getTime() -
          new Date(a.payrollPeriodStart).getTime(),
      );
      setRuns(rows);
      if (rows.length > 0 && !selectedRunId) {
        setSelectedRunId(rows[0].payrollId);
      }
    } catch (err) {
      setRuns([]);
      setError(
        err instanceof Error ? err.message : "Failed to load payroll history",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedRunId) {
        setSelectedRun(null);
        return;
      }
      try {
        setLoadingDetail(true);
        setDetailError(null);
        const result = await getPayrollRunDetails(selectedRunId);
        if (!result.success) {
          throw new Error(result.error || "Failed to load payroll run details");
        }
        setSelectedRun(result.data ?? null);
      } catch (err) {
        setSelectedRun(null);
        setDetailError(
          err instanceof Error ? err.message : "Failed to load payroll run details",
        );
      } finally {
        setLoadingDetail(false);
      }
    };

    void loadDetail();
  }, [selectedRunId]);

  const filteredRuns = useMemo(() => {
    const query = search.trim().toLowerCase();

    return runs.filter((run) => {
      if (statusFilter !== "ALL" && run.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== "ALL" && run.payrollType !== typeFilter) {
        return false;
      }

      const startDate = new Date(run.payrollPeriodStart);
      if (yearFilter !== "ALL" && String(startDate.getFullYear()) !== yearFilter) {
        return false;
      }
      if (
        monthFilter !== "ALL" &&
        String(startDate.getMonth() + 1) !== monthFilter
      ) {
        return false;
      }

      if (!query) return true;

      return (
        run.payrollId.toLowerCase().includes(query) ||
        humanizePayrollType(run.payrollType).toLowerCase().includes(query) ||
        (run.createdByName ?? "").toLowerCase().includes(query) ||
        (run.notes ?? "").toLowerCase().includes(query)
      );
    });
  }, [monthFilter, runs, search, statusFilter, typeFilter, yearFilter]);

  const groupedRuns = useMemo(() => {
    const groups = new Map<string, PayrollRunSummary[]>();

    filteredRuns.forEach((run) => {
      const date = new Date(run.payrollPeriodStart);
      const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)!.push(run);
    });

    return Array.from(groups.entries()).map(([label, items]) => ({
      label,
      items,
      count: items.length,
      netTotal: items.reduce((sum, run) => sum + run.netTotal, 0),
    }));
  }, [filteredRuns]);

  const yearOptions = useMemo(() => {
    return Array.from(
      new Set(
        runs.map((run) => String(new Date(run.payrollPeriodStart).getFullYear())),
      ),
    ).sort((left, right) => Number(right) - Number(left));
  }, [runs]);

  const visibleGroups = useMemo(
    () => groupedRuns.slice(0, visibleMonthCount),
    [groupedRuns, visibleMonthCount],
  );

  useEffect(() => {
    if (filteredRuns.length === 0) {
      setSelectedRunId(null);
      return;
    }

    if (
      !selectedRunId ||
      !filteredRuns.some((run) => run.payrollId === selectedRunId)
    ) {
      setSelectedRunId(filteredRuns[0].payrollId);
    }
  }, [filteredRuns, selectedRunId]);

  useEffect(() => {
    setVisibleMonthCount(Math.min(DEFAULT_VISIBLE_MONTHS, groupedRuns.length));
  }, [groupedRuns]);

  useEffect(() => {
    setExpandedGroups((current) => {
      const next: Record<string, boolean> = {};
      groupedRuns.forEach((group, index) => {
        next[group.label] = current[group.label] ?? index < DEFAULT_EXPANDED_MONTHS;
      });
      return next;
    });

    setVisibleRunsByGroup((current) => {
      const next: Record<string, number> = {};
      groupedRuns.forEach((group) => {
        next[group.label] = Math.min(
          current[group.label] ?? DEFAULT_VISIBLE_RUNS_PER_MONTH,
          group.items.length,
        );
      });
      return next;
    });
  }, [groupedRuns]);

  const totals = useMemo(
    () => ({
      gross: filteredRuns.reduce((sum, run) => sum + run.grossTotal, 0),
      net: filteredRuns.reduce((sum, run) => sum + run.netTotal, 0),
      employees: filteredRuns.reduce((sum, run) => sum + run.employeeCount, 0),
    }),
    [filteredRuns],
  );

  const statCards = [
    {
      label: "Runs",
      value: `${filteredRuns.length}`,
      accent: "Active archive view",
      icon: Archive,
    },
    {
      label: "Gross Total",
      value: formatCurrency(totals.gross),
      accent: "Before deductions",
      icon: CircleDollarSign,
    },
    {
      label: "Employees Covered",
      value: `${totals.employees}`,
      accent: "Across filtered runs",
      icon: UsersRound,
    },
    {
      label: "Net Total",
      value: formatCurrency(totals.net),
      accent: "Released and retained pay",
      icon: WalletCards,
    },
  ];

  if (loading && runs.length === 0 && !error) {
    return (
      <ModuleLoadingState
        title="Payroll History"
        description="Loading payroll runs, archive filters, and run details."
      />
    );
  }

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
          Payroll Archive
        </p>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Payroll History
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Review completed payroll periods, trace approvals, and open any run
            to inspect employee-level totals without leaving the archive.
          </p>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[28px] border border-orange-200/70 bg-gradient-to-br from-orange-50 via-background to-amber-50 p-6 shadow-[0_24px_60px_-36px_rgba(249,115,22,0.45)] sm:p-7">
        <div className="absolute inset-y-0 right-0 w-80 bg-[radial-gradient(circle_at_center,_rgba(249,115,22,0.18),_transparent_68%)]" />
        <div className="absolute -left-12 top-10 h-28 w-28 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="absolute bottom-0 right-20 h-32 w-32 rounded-full bg-amber-200/30 blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary shadow-sm">
              <Archive className="h-3.5 w-3.5" />
              Archive Workspace
            </div>
            <p className="text-sm font-medium uppercase tracking-[0.26em] text-slate-500">
              Payroll History
            </p>
            <h2 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Audit payroll runs with the same orange system language used across the app.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">
              Filter by month, status, and payroll type, then jump into one run
              to inspect approvals, totals, and line-level deductions in a
              focused workspace.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-[22px] border border-orange-200/70 bg-white/88 px-4 py-4 shadow-sm backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {card.label}
                    </p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                      {card.value}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-primary">
                    <card.icon className="h-4.5 w-4.5" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">{card.accent}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Card className="overflow-hidden rounded-[28px] border border-orange-100/70 bg-card/95 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.45)]">
        <CardHeader className="space-y-4 border-b border-orange-100/70 bg-gradient-to-r from-orange-50/80 via-background to-background">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">
                <Filter className="h-3.5 w-3.5" />
                Archive Filters
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Filter and inspect payroll runs
              </CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Keep the archive readable while still preserving quick access to
                approvals, totals, and notes.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void load()}
              className="gap-2 shadow-sm"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          <div className="grid gap-3 rounded-[24px] border border-orange-100/80 bg-orange-50/55 p-3 lg:grid-cols-[1.2fr_repeat(4,minmax(0,170px))]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search payroll id, type, note, or creator"
              className="h-11 rounded-xl border-orange-200/70 bg-white/90 shadow-sm placeholder:text-slate-400 focus-visible:ring-orange-200"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className={archiveFilterClass}
            >
              <option value="ALL">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="RELEASED">Released</option>
              <option value="FINALIZED">Finalized</option>
              <option value="VOIDED">Voided</option>
            </select>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className={archiveFilterClass}
            >
              <option value="ALL">All types</option>
              <option value="BIMONTHLY">Bi-monthly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
              <option value="OFF_CYCLE">Off-cycle</option>
            </select>
            <select
              value={yearFilter}
              onChange={(event) =>
                setYearFilter(event.target.value as "ALL" | `${number}`)
              }
              className={archiveFilterClass}
            >
              <option value="ALL">All years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              value={monthFilter}
              onChange={(event) =>
                setMonthFilter(event.target.value as MonthFilter)
              }
              className={archiveFilterClass}
            >
              <option value="ALL">All months</option>
              {monthNames.map((month, index) => (
                <option key={month} value={String(index + 1)}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <InlineLoadingState label="Loading payroll history" lines={3} />
          ) : null}
          {!loading && error ? (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {!loading && !error && groupedRuns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-orange-200/70 bg-orange-50/35 p-5 text-sm text-slate-600">
              No payroll runs found for selected filters.
            </div>
          ) : null}

          {!loading && !error && groupedRuns.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {visibleGroups.length} of {groupedRuns.length} month sections.
              </p>
              <div className="flex flex-wrap gap-2">
                {groupedRuns.length > visibleMonthCount ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-orange-200 bg-orange-50 text-primary hover:bg-orange-100 hover:text-primary"
                    onClick={() =>
                      setVisibleMonthCount((current) =>
                        Math.min(current + DEFAULT_VISIBLE_MONTHS, groupedRuns.length),
                      )
                    }
                  >
                    Show More Months
                  </Button>
                ) : null}
                {visibleMonthCount > Math.min(DEFAULT_VISIBLE_MONTHS, groupedRuns.length) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-primary hover:bg-orange-50 hover:text-primary"
                    onClick={() =>
                      setVisibleMonthCount(
                        Math.min(DEFAULT_VISIBLE_MONTHS, groupedRuns.length),
                      )
                    }
                  >
                    Show Recent Only
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="space-y-4">
            {!loading &&
              !error &&
              visibleGroups.map((group) => (
                <div
                  key={group.label}
                  className="space-y-4 rounded-[24px] border border-orange-100/80 bg-gradient-to-br from-white via-orange-50/35 to-amber-50/25 p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold tracking-tight text-slate-950">
                        {group.label}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {group.count} runs · Net {formatCurrency(group.netTotal)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-orange-200 bg-white/80 text-primary"
                      >
                        {group.count} runs
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-primary hover:bg-orange-100/70 hover:text-primary"
                        onClick={() =>
                          setExpandedGroups((current) => ({
                            ...current,
                            [group.label]: !current[group.label],
                          }))
                        }
                      >
                        {expandedGroups[group.label] ? "Collapse" : "Expand"}
                      </Button>
                    </div>
                  </div>
                  {expandedGroups[group.label] ? (
                    <div className="space-y-3">
                      {group.items
                        .slice(
                          0,
                          visibleRunsByGroup[group.label] ??
                            DEFAULT_VISIBLE_RUNS_PER_MONTH,
                        )
                        .map((run) => {
                      const selected = selectedRunId === run.payrollId;

                      return (
                        <button
                          key={run.payrollId}
                          type="button"
                          onClick={() => setSelectedRunId(run.payrollId)}
                          className={cn(
                            "w-full rounded-[22px] border border-orange-100/80 bg-white/92 p-4 text-left shadow-sm transition-all",
                            "hover:-translate-y-0.5 hover:border-orange-300/80 hover:shadow-md",
                            selected &&
                              "border-orange-300 bg-gradient-to-r from-orange-50 to-white shadow-[0_18px_30px_-24px_rgba(249,115,22,0.55)] ring-1 ring-orange-200/70",
                          )}
                        >
                          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(280px,0.9fr)] xl:items-start">
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-semibold leading-tight">
                                  {formatDateRange(
                                    run.payrollPeriodStart,
                                    run.payrollPeriodEnd,
                                  )}
                                </p>
                                {isReturnedRun(run) ? (
                                  <span className="rounded-full border border-orange-600/40 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                                    Returned
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                                <span>
                                  {run.createdByName
                                    ? `Created by ${run.createdByName}`
                                    : "System generated"}
                                </span>
                                <span>{runActivityLabel(run)}</span>
                              </div>
                              {run.notes ? (
                                <p
                                  className="truncate text-sm text-slate-500"
                                  title={run.notes}
                                >
                                  {run.notes}
                                </p>
                              ) : null}
                            </div>

                            <div className="space-y-3">
                              <div className="flex flex-wrap gap-2">
                                <Badge
                                  variant="outline"
                                  className={payrollTypeClass(run.payrollType)}
                                >
                                  {humanizePayrollType(run.payrollType)}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={statusClass(run.status)}
                                >
                                  {run.status}
                                </Badge>
                              </div>
                              <div className="grid gap-2 rounded-2xl border border-orange-100/80 bg-orange-50/45 p-3 text-sm text-slate-600 sm:grid-cols-2">
                                <span>{run.employeeCount} employees</span>
                                <span>Gross {formatCurrency(run.grossTotal)}</span>
                                <span>Net {formatCurrency(run.netTotal)}</span>
                                <span>
                                  Deductions {formatCurrency(run.deductionsTotal)}
                                </span>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-orange-100/80 bg-slate-50/80 p-4">
                              <div className="flex flex-wrap gap-2">
                                <Badge
                                  variant="outline"
                                  className={decisionClass(run.managerDecision)}
                                >
                                  Manager: {run.managerDecision}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={decisionClass(run.gmDecision)}
                                >
                                  GM: {run.gmDecision}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm text-slate-600">
                                {run.releasedByName
                                  ? `Released by ${run.releasedByName}`
                                  : "Release pending or not recorded"}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                      {group.items.length >
                      (visibleRunsByGroup[group.label] ??
                        DEFAULT_VISIBLE_RUNS_PER_MONTH) ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-orange-200 bg-white text-primary hover:bg-orange-50 hover:text-primary"
                            onClick={() =>
                              setVisibleRunsByGroup((current) => ({
                                ...current,
                                [group.label]: Math.min(
                                  (current[group.label] ??
                                    DEFAULT_VISIBLE_RUNS_PER_MONTH) +
                                    DEFAULT_VISIBLE_RUNS_PER_MONTH,
                                  group.items.length,
                                ),
                              }))
                            }
                          >
                            Show More Runs
                          </Button>
                        </div>
                      ) : null}
                      {(visibleRunsByGroup[group.label] ??
                        DEFAULT_VISIBLE_RUNS_PER_MONTH) >
                      DEFAULT_VISIBLE_RUNS_PER_MONTH ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-primary hover:bg-orange-50 hover:text-primary"
                          onClick={() =>
                            setVisibleRunsByGroup((current) => ({
                              ...current,
                              [group.label]: Math.min(
                                DEFAULT_VISIBLE_RUNS_PER_MONTH,
                                group.items.length,
                              ),
                            }))
                          }
                        >
                          Show Fewer Runs
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-orange-200/70 bg-orange-50/30 p-4 text-sm text-slate-600">
                      Section collapsed. Expand to view runs for {group.label}.
                    </div>
                  )}
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <PayrollRunDetailsCard
        run={selectedRun}
        loading={loadingDetail}
        error={detailError}
      />
    </div>
  );
};

export default PayrollHistoryPage;
