"use client";

import { useEffect, useMemo, useState } from "react";
import {
  generatePayrollRun,
  getPayrollGenerationReadiness,
  getPayrollRunDetails,
  listPayrollEligibleEmployees,
  listPayrollRuns,
  regenerateRejectedPayrollRun,
} from "@/actions/payroll/payroll-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InlineLoadingState,
  TableLoadingState,
} from "@/components/loading/loading-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  PayrollEligibleEmployeeOption,
  PayrollGenerationReadiness,
  PayrollRunDetail,
  PayrollRunSummary,
  PayrollTypeValue,
} from "@/types/payroll";
import {
  formatCurrency,
  formatDateTime,
  formatDateRange,
  humanizePayrollType,
  payrollTypeClass,
  statusClass,
} from "./payroll-ui-helpers";
import PayrollRunDetailsCard from "./payroll-run-details-card";

type RunMode = "STANDARD" | "CUSTOM";
type BiMonthlyHalf = "FIRST" | "SECOND";

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

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getHalfRange = (
  year: number,
  monthIndex: number,
  half: BiMonthlyHalf,
) => {
  const startDay = half === "FIRST" ? 1 : 16;
  const endDay =
    half === "FIRST" ? 15 : new Date(year, monthIndex + 1, 0).getDate();
  return {
    start: toIsoDate(new Date(year, monthIndex, startDay, 12, 0, 0, 0)),
    end: toIsoDate(new Date(year, monthIndex, endDay, 12, 0, 0, 0)),
  };
};

const getDefaultHalfConfig = () => {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const half: BiMonthlyHalf = now.getDate() <= 15 ? "FIRST" : "SECOND";
  const range = getHalfRange(year, monthIndex, half);
  return { year, monthIndex, half, ...range };
};

const isRejectedRun = (run: PayrollRunSummary) =>
  run.managerDecision === "REJECTED" || run.gmDecision === "REJECTED";

const isActionableRun = (run: PayrollRunSummary) =>
  run.status === "DRAFT" || isRejectedRun(run);

const ACTIONABLE_RUN_WINDOW_DAYS = 60;

const PayrollGeneratePage = () => {
  const toast = useToast();
  const defaults = useMemo(() => getDefaultHalfConfig(), []);

  const [mode, setMode] = useState<RunMode>("STANDARD");
  const [selectedYear, setSelectedYear] = useState(defaults.year);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(defaults.monthIndex);
  const [selectedHalf, setSelectedHalf] = useState<BiMonthlyHalf>(defaults.half);

  const [customStart, setCustomStart] = useState(defaults.start);
  const [customEnd, setCustomEnd] = useState(defaults.end);
  const [customReason, setCustomReason] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<PayrollGenerationReadiness | null>(
    null,
  );
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [eligibleEmployees, setEligibleEmployees] = useState<
    PayrollEligibleEmployeeOption[]
  >([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const [runs, setRuns] = useState<PayrollRunSummary[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PayrollRunDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const standardRange = useMemo(
    () => getHalfRange(selectedYear, selectedMonthIndex, selectedHalf),
    [selectedHalf, selectedMonthIndex, selectedYear],
  );

  const activeRange =
    mode === "STANDARD"
      ? standardRange
      : { start: customStart.trim(), end: customEnd.trim() };
  const activePayrollType: PayrollTypeValue =
    mode === "CUSTOM" ? "OFF_CYCLE" : "BIMONTHLY";

  const activeEmployeeScope = useMemo(
    () => (mode === "CUSTOM" ? selectedEmployeeIds : undefined),
    [mode, selectedEmployeeIds],
  );

  const yearOptions = useMemo(() => {
    const base = defaults.year;
    return [base - 2, base - 1, base, base + 1, base + 2];
  }, [defaults.year]);

  const draftOrReturnedRuns = useMemo(
    () => runs.filter((run) => isActionableRun(run)),
    [runs],
  );

  const visibleActionableRuns = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ACTIONABLE_RUN_WINDOW_DAYS);
    return draftOrReturnedRuns.filter(
      (run) => new Date(run.generatedAt).getTime() >= cutoff.getTime(),
    );
  }, [draftOrReturnedRuns]);

  const hiddenActionableCount = Math.max(
    0,
    draftOrReturnedRuns.length - visibleActionableRuns.length,
  );

  const draftCount = useMemo(
    () => runs.filter((run) => run.status === "DRAFT").length,
    [runs],
  );

  const returnedCount = useMemo(
    () => runs.filter((run) => isRejectedRun(run)).length,
    [runs],
  );

  const filteredEligibleEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    if (!term) return eligibleEmployees;
    return eligibleEmployees.filter((row) =>
      `${row.employeeCode} ${row.employeeName}`.toLowerCase().includes(term),
    );
  }, [eligibleEmployees, employeeSearch]);

  const allFilteredSelected = useMemo(() => {
    if (filteredEligibleEmployees.length === 0) return false;
    const selected = new Set(selectedEmployeeIds);
    return filteredEligibleEmployees.every((employee) =>
      selected.has(employee.employeeId),
    );
  }, [filteredEligibleEmployees, selectedEmployeeIds]);

  const loadRuns = async () => {
    try {
      setLoadingRuns(true);
      setError(null);
      const result = await listPayrollRuns({ limit: 36 });
      if (!result.success) {
        throw new Error(result.error || "Failed to load payroll runs");
      }
      const rows = result.data ?? [];
      setRuns(rows);

      if (rows.length === 0) {
        setSelectedRunId(null);
        return;
      }

      const preferred =
        rows.find((run) => isActionableRun(run)) ??
        rows.find((run) => run.payrollId === selectedRunId) ??
        rows[0];
      setSelectedRunId(preferred.payrollId);
    } catch (err) {
      setRuns([]);
      setError(err instanceof Error ? err.message : "Failed to load payroll runs");
    } finally {
      setLoadingRuns(false);
    }
  };

  const loadEligibleEmployees = async () => {
    try {
      setEligibleLoading(true);
      const result = await listPayrollEligibleEmployees({ limit: 500 });
      if (!result.success) {
        throw new Error(result.error || "Failed to load employees");
      }
      setEligibleEmployees(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees");
      setEligibleEmployees([]);
    } finally {
      setEligibleLoading(false);
    }
  };

  const loadReadiness = async (
    start: string,
    end: string,
    employeeIds?: string[],
  ) => {
    if (!start || !end) {
      setReadiness(null);
      setReadinessError("Payroll period start and end are required.");
      return;
    }

    if (mode === "CUSTOM" && (!employeeIds || employeeIds.length === 0)) {
      setReadiness(null);
      setReadinessError("Select at least one employee for off-cycle payroll.");
      return;
    }

    try {
      setReadinessLoading(true);
      setReadinessError(null);
      const result = await getPayrollGenerationReadiness({
        payrollPeriodStart: start,
        payrollPeriodEnd: end,
        employeeIds,
        limit: 20,
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to load lock readiness.");
      }
      setReadiness(result.data);
    } catch (err) {
      setReadiness(null);
      setReadinessError(
        err instanceof Error ? err.message : "Failed to load lock readiness.",
      );
    } finally {
      setReadinessLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadRuns(), loadEligibleEmployees()]);
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
          throw new Error(result.error || "Failed to load payroll details");
        }
        setSelectedRun(result.data ?? null);
      } catch (err) {
        setSelectedRun(null);
        setDetailError(
          err instanceof Error ? err.message : "Failed to load payroll details",
        );
      } finally {
        setLoadingDetail(false);
      }
    };

    void loadDetail();
  }, [selectedRunId]);

  useEffect(() => {
    void loadReadiness(activeRange.start, activeRange.end, activeEmployeeScope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRange.start, activeRange.end, mode, selectedEmployeeIds.join("|")]);

  const handleGenerate = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (!activeRange.start || !activeRange.end) {
        throw new Error("Payroll period start and end are required.");
      }
      if (mode === "CUSTOM" && selectedEmployeeIds.length === 0) {
        throw new Error("Select at least one employee for off-cycle payroll.");
      }
      if (readinessLoading) {
        throw new Error("Checking attendance lock readiness. Please wait.");
      }
      if (!readiness || !readiness.allLocked) {
        const unlocked = readiness?.unlockedRows ?? 0;
        throw new Error(
          `Cannot generate payroll. ${unlocked} unlocked unpaid attendance row(s) found for this period.`,
        );
      }

      const startDate = new Date(activeRange.start);
      const endDate = new Date(activeRange.end);
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime()) ||
        startDate.getTime() > endDate.getTime()
      ) {
        throw new Error("Payroll period is invalid.");
      }

      const noteParts: string[] = [];
      if (mode === "STANDARD") {
        noteParts.push(
          `${monthNames[selectedMonthIndex]} ${selectedYear} ${selectedHalf === "FIRST" ? "1st half" : "2nd half"}`,
        );
      } else {
        const trimmedReason = customReason.trim();
        if (!trimmedReason) {
          throw new Error("Reason is required for off-cycle payroll.");
        }
        noteParts.push(`OFF-CYCLE: ${trimmedReason}`);
      }
      if (notes.trim()) {
        noteParts.push(notes.trim());
      }

      const result = await generatePayrollRun({
        payrollPeriodStart: activeRange.start,
        payrollPeriodEnd: activeRange.end,
        payrollType: activePayrollType,
        notes: noteParts.join(" | "),
        employeeIds: mode === "CUSTOM" ? selectedEmployeeIds : undefined,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to generate payroll");
      }

      const createdRun = result.data;
      setSuccess("Payroll draft generated successfully.");
      toast.success("Payroll draft generated successfully.");
      if (createdRun) {
        setSelectedRunId(createdRun.payrollId);
      }
      await Promise.all([
        loadRuns(),
        loadReadiness(activeRange.start, activeRange.end, activeEmployeeScope),
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate payroll";
      setError(message);
      toast.error("Failed to generate payroll.", {
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateRejected = async () => {
    if (!selectedRunId) return;
    try {
      setRegenerating(true);
      setError(null);
      setSuccess(null);
      const result = await regenerateRejectedPayrollRun(selectedRunId);
      if (!result.success) {
        throw new Error(result.error || "Failed to regenerate rejected payroll");
      }
      setSuccess("Rejected payroll regenerated into a new draft.");
      toast.success("Rejected payroll regenerated into a new draft.");
      if (result.data?.payrollId) {
        setSelectedRunId(result.data.payrollId);
      }
      await loadRuns();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to regenerate rejected payroll";
      setError(message);
      toast.error("Failed to regenerate rejected payroll.", {
        description: message,
      });
    } finally {
      setRegenerating(false);
    }
  };

  const toggleEmployeeSelection = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      const selected = new Set(current);
      if (checked) {
        selected.add(employeeId);
      } else {
        selected.delete(employeeId);
      }
      return Array.from(selected);
    });
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    if (!checked) {
      const visibleIds = new Set(
        filteredEligibleEmployees.map((employee) => employee.employeeId),
      );
      setSelectedEmployeeIds((current) =>
        current.filter((id) => !visibleIds.has(id)),
      );
      return;
    }

    setSelectedEmployeeIds((current) => {
      const selected = new Set(current);
      filteredEligibleEmployees.forEach((employee) => {
        selected.add(employee.employeeId);
      });
      return Array.from(selected);
    });
  };

  const selectedRunSummary =
    runs.find((run) => run.payrollId === selectedRunId) ?? null;
  const selectedRunIsRejected = Boolean(
    selectedRunSummary && isRejectedRun(selectedRunSummary),
  );

  const lockCoverage = useMemo(() => {
    if (!readiness || readiness.totalRows <= 0) return 100;
    return Math.round((readiness.lockedRows / readiness.totalRows) * 100);
  }, [readiness]);

  const canGenerateFromReadiness = Boolean(
    readiness &&
      readinessError == null &&
      readinessLoading === false &&
      readiness.allLocked &&
      (mode === "STANDARD" || selectedEmployeeIds.length > 0),
  );

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">Generate Payroll</h1>
        <p className="text-sm text-muted-foreground">
          Build payroll drafts using standard bi-monthly periods or off-cycle
          custom runs.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg">1. Payroll Setup</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pick a standard half or create an off-cycle run.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-1">
              <Button
                type="button"
                size="sm"
                variant={mode === "STANDARD" ? "default" : "ghost"}
                onClick={() => setMode("STANDARD")}
                className="h-8"
              >
                Standard Bi-monthly
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "CUSTOM" ? "default" : "ghost"}
                onClick={() => setMode("CUSTOM")}
                className="h-8"
              >
                Off-cycle Custom
              </Button>
            </div>

            {mode === "STANDARD" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="payroll-year">Year</Label>
                  <select
                    id="payroll-year"
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(Number(event.target.value))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payroll-month">Month</Label>
                  <select
                    id="payroll-month"
                    value={selectedMonthIndex}
                    onChange={(event) =>
                      setSelectedMonthIndex(Number(event.target.value))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {monthNames.map((month, index) => (
                      <option key={month} value={index}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payroll-half">Half</Label>
                  <select
                    id="payroll-half"
                    value={selectedHalf}
                    onChange={(event) =>
                      setSelectedHalf(event.target.value as BiMonthlyHalf)
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="FIRST">1st half (1-15)</option>
                    <option value="SECOND">2nd half (16-end)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="custom-period-start">Period Start</Label>
                    <Input
                      id="custom-period-start"
                      type="date"
                      value={customStart}
                      onChange={(event) => setCustomStart(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-period-end">Period End</Label>
                    <Input
                      id="custom-period-end"
                      type="date"
                      value={customEnd}
                      onChange={(event) => setCustomEnd(event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-reason">Reason (Required)</Label>
                  <Input
                    id="custom-reason"
                    value={customReason}
                    onChange={(event) => setCustomReason(event.target.value)}
                    placeholder="Example: Employee emergency early payroll release"
                  />
                </div>
                <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        Employees (Required for Off-cycle)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pick one or more employees included in this custom run.
                      </p>
                    </div>
                    <Badge variant="outline">
                      {selectedEmployeeIds.length} selected
                    </Badge>
                  </div>

                  <Input
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Search by employee code or name"
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => toggleSelectAllFiltered(true)}
                      disabled={
                        filteredEligibleEmployees.length === 0 || allFilteredSelected
                      }
                    >
                      Select Visible
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => toggleSelectAllFiltered(false)}
                      disabled={filteredEligibleEmployees.length === 0}
                    >
                      Clear Visible
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedEmployeeIds([])}
                      disabled={selectedEmployeeIds.length === 0}
                    >
                      Clear All
                    </Button>
                  </div>

                  <div className="max-h-56 overflow-y-auto rounded-md border">
                    {eligibleLoading ? (
                      <div className="p-3">
                        <InlineLoadingState label="Loading employees" lines={2} />
                      </div>
                    ) : filteredEligibleEmployees.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        No employees match your search.
                      </p>
                    ) : (
                      filteredEligibleEmployees.map((employee) => {
                        const isSelected = selectedEmployeeIds.includes(
                          employee.employeeId,
                        );
                        return (
                          <label
                            key={employee.employeeId}
                            className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-muted/30"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border border-border"
                              checked={isSelected}
                              onChange={(event) =>
                                toggleEmployeeSelection(
                                  employee.employeeId,
                                  event.currentTarget.checked,
                                )
                              }
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {employee.employeeName}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {employee.employeeCode}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Payroll Type
              </p>
              <p className="text-sm font-medium">
                {mode === "STANDARD"
                  ? "Bi-monthly (fixed by policy)"
                  : humanizePayrollType(activePayrollType)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Period: {formatDateRange(activeRange.start, activeRange.end)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payroll-notes">Additional Notes (Optional)</Label>
              <Input
                id="payroll-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional internal context for this run"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">2. Attendance Readiness</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void loadReadiness(
                    activeRange.start,
                    activeRange.end,
                    activeEmployeeScope,
                  )
                }
                disabled={readinessLoading}
              >
                {readinessLoading ? "Checking..." : "Refresh"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Payroll can run only when unpaid attendance rows are fully locked.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {readinessError ? (
              <p className="text-sm text-destructive">{readinessError}</p>
            ) : null}

            {readiness ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Rows In Scope
                    </p>
                    <p className="text-sm font-semibold">{readiness.totalRows}</p>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Active Employees
                    </p>
                    <p className="text-sm font-semibold">{readiness.activeEmployees}</p>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Locked
                    </p>
                    <p className="text-sm font-semibold">{readiness.lockedRows}</p>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Unlocked
                    </p>
                    <p className="text-sm font-semibold text-destructive">
                      {readiness.unlockedRows}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Lock Coverage</span>
                    <span>{lockCoverage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all ${
                        readiness.allLocked ? "bg-emerald-600" : "bg-amber-500"
                      }`}
                      style={{ width: `${lockCoverage}%` }}
                    />
                  </div>
                </div>

                {!readiness.allLocked && readiness.unlockedEmployees.length > 0 ? (
                  <div className="overflow-hidden rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Top Blocking Employees</TableHead>
                          <TableHead className="w-20 text-right">Rows</TableHead>
                          <TableHead>Date Range</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {readiness.unlockedEmployees.map((row) => (
                          <TableRow key={row.employeeId}>
                            <TableCell>
                              <p className="font-medium">{row.employeeName}</p>
                              <p className="text-xs text-muted-foreground">
                                {row.employeeCode}
                              </p>
                            </TableCell>
                            <TableCell className="text-right font-medium text-destructive">
                              {row.unlockedRows}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.firstUnlockedDate === row.lastUnlockedDate
                                ? row.firstUnlockedDate
                                : `${row.firstUnlockedDate} to ${row.lastUnlockedDate}`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}

                <div className="rounded-md border bg-muted/20 p-3 text-xs">
                  {readiness.allLocked ? (
                    <span className="text-emerald-700">
                      Ready: all attendance rows in this period are locked.
                    </span>
                  ) : (
                    <span className="text-amber-700">
                      Blocked: lock all unpaid attendance rows first.
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Checking attendance readiness...
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">3. Generate Draft</CardTitle>
          <p className="text-sm text-muted-foreground">
            Run generation after readiness passes, or regenerate returned drafts.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={saving || !canGenerateFromReadiness}
            >
              {saving ? "Generating..." : "Generate Payroll Draft"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleRegenerateRejected()}
              disabled={!selectedRunIsRejected || regenerating}
            >
              {regenerating ? "Regenerating..." : "Regenerate Rejected"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void loadRuns()}>
              Refresh Queue
            </Button>
          </div>

          {selectedRunSummary ? (
            <p className="text-xs text-muted-foreground">
              Selected run:{" "}
              {formatDateRange(
                selectedRunSummary.payrollPeriodStart,
                selectedRunSummary.payrollPeriodEnd,
              )}{" "}
              · Manager {selectedRunSummary.managerDecision} · GM{" "}
              {selectedRunSummary.gmDecision}
            </p>
          ) : null}
          {!selectedRunIsRejected && selectedRunSummary ? (
            <p className="text-xs text-muted-foreground">
              Regeneration is available only for rejected payroll runs.
            </p>
          ) : null}

          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Draft & Returned Runs</CardTitle>
            <Badge variant="outline">{visibleActionableRuns.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border px-2 py-1">Draft: {draftCount}</span>
            <span className="rounded-full border px-2 py-1">
              Returned: {returnedCount}
            </span>
            <span className="rounded-full border px-2 py-1">
              Window: last {ACTIONABLE_RUN_WINDOW_DAYS} days
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {hiddenActionableCount > 0 ? (
            <p className="mb-3 text-xs text-muted-foreground">
              {hiddenActionableCount} older actionable run(s) are hidden here to
              keep the drafting queue clean. Use Payroll History to inspect them.
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingRuns ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-3">
                      <TableLoadingState
                        label="Loading payroll queue"
                        columns={6}
                        rows={3}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}

                {!loadingRuns && visibleActionableRuns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No draft/returned runs. Use Payroll History for released runs.
                    </TableCell>
                  </TableRow>
                ) : null}

                {!loadingRuns &&
                  visibleActionableRuns.map((run) => (
                    <TableRow
                      key={run.payrollId}
                      className={
                        selectedRunId === run.payrollId ? "bg-primary/5" : undefined
                      }
                      onClick={() => setSelectedRunId(run.payrollId)}
                    >
                      <TableCell className="font-medium">
                        {formatDateRange(
                          run.payrollPeriodStart,
                          run.payrollPeriodEnd,
                        )}
                        <p className="text-xs text-muted-foreground">
                          {run.createdByName ? `By ${run.createdByName}` : "System draft"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={payrollTypeClass(run.payrollType)}
                        >
                          {humanizePayrollType(run.payrollType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(run.status)}>
                          {run.status}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          M: {run.managerDecision} · GM: {run.gmDecision}
                        </p>
                      </TableCell>
                      <TableCell>{run.employeeCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(run.generatedAt)}
                      </TableCell>
                      <TableCell>{formatCurrency(run.netTotal)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PayrollRunDetailsCard run={selectedRun} loading={loadingDetail} error={detailError} />
    </div>
  );
};

export default PayrollGeneratePage;
