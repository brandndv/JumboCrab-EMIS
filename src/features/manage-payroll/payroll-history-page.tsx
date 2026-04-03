"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPayrollRunDetails,
  listPayrollRuns,
} from "@/actions/payroll/payroll-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineLoadingState } from "@/components/loading/loading-states";
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

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div>
        <h1 className="text-2xl font-semibold">Payroll History</h1>
        <p className="text-sm text-muted-foreground">
          Search previous payroll runs and inspect detailed employee breakdown.
        </p>
      </div>

      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Payroll Archive
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Search past payroll runs without falling back to a wide table.
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Filter by period, type, and status, then open any run to inspect
              approvals, employee totals, and line-level details in one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Runs
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {filteredRuns.length}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Gross Total
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {formatCurrency(totals.gross)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Employees Covered
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {totals.employees}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Net Total
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {formatCurrency(totals.net)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Card className="rounded-2xl border border-border/70 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Archive</CardTitle>
              <p className="text-sm text-muted-foreground">
                Responsive archive cards keep older runs readable as volume grows.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
          <div className="grid gap-2 lg:grid-cols-[1.2fr_repeat(4,minmax(0,160px))]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search payroll id, type, note, or creator"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
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
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
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
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
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
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
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
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {!loading && !error && groupedRuns.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
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
                  className="space-y-4 rounded-2xl border border-border/70 bg-gradient-to-b from-background to-muted/10 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold">{group.label}</h3>
                      <p className="text-sm text-muted-foreground">
                        {group.count} runs · Net {formatCurrency(group.netTotal)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{group.count} runs</Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
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
                            "w-full rounded-2xl border border-border/70 bg-background/85 p-4 text-left transition-all",
                            "hover:-translate-y-0.5 hover:border-border hover:shadow-sm",
                            selected &&
                              "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/10",
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
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span>
                                  {run.createdByName
                                    ? `Created by ${run.createdByName}`
                                    : "System generated"}
                                </span>
                                <span>{runActivityLabel(run)}</span>
                              </div>
                              {run.notes ? (
                                <p
                                  className="truncate text-sm text-muted-foreground"
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
                              <div className="grid gap-2 rounded-2xl border border-dashed border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground sm:grid-cols-2">
                                <span>{run.employeeCount} employees</span>
                                <span>Gross {formatCurrency(run.grossTotal)}</span>
                                <span>Net {formatCurrency(run.netTotal)}</span>
                                <span>
                                  Deductions {formatCurrency(run.deductionsTotal)}
                                </span>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
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
                              <p className="mt-2 text-sm text-muted-foreground">
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
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
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
