"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPayrollRunDetails,
  listPayrollRuns,
  releasePayrollRun,
  reviewPayrollRun,
} from "@/actions/payroll/payroll-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineLoadingState } from "@/components/loading/loading-states";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import type {
  PayrollRunDetail,
  PayrollRunSummary,
  PayrollTypeValue,
} from "@/types/payroll";
import {
  decisionClass,
  formatCurrency,
  formatDateRange,
  formatDateTime,
  humanizePayrollType,
  payrollTypeClass,
  statusClass,
} from "./payroll-ui-helpers";
import PayrollRunDetailsCard from "./payroll-run-details-card";

type QueueView = "NEEDS_ACTION" | "RETURNED" | "RELEASED" | "ALL";

const isReturnedRun = (run: PayrollRunSummary) =>
  run.managerDecision === "REJECTED" || run.gmDecision === "REJECTED";

const isReadyForRelease = (run: PayrollRunSummary) =>
  run.status === "REVIEWED" &&
  run.managerDecision === "APPROVED" &&
  run.gmDecision === "APPROVED";

const isNeedsActionRun = (run: PayrollRunSummary) => {
  if (run.status === "RELEASED" || isReturnedRun(run)) {
    return false;
  }

  return (
    run.status === "REVIEWED" ||
    run.managerDecision === "PENDING" ||
    run.gmDecision === "PENDING"
  );
};

const getApprovalProgress = (run: PayrollRunSummary) => {
  if (run.managerDecision === "PENDING") return 0;
  if (run.gmDecision === "PENDING") return 55;
  return 100;
};

const getApprovalProgressClass = (run: PayrollRunSummary) => {
  if (run.managerDecision === "REJECTED" || run.gmDecision === "REJECTED") {
    return "bg-destructive";
  }
  if (run.managerDecision === "APPROVED" && run.gmDecision === "APPROVED") {
    return "bg-emerald-600";
  }
  return "bg-amber-500";
};

const approvalLabelClass = (decision: PayrollRunSummary["managerDecision"]) =>
  cn(
    "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
    decisionClass(decision),
  );

const ApprovalCell = ({
  run,
  className,
}: {
  run: PayrollRunSummary;
  className?: string;
}) => (
  <div className={cn("space-y-2", className)}>
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">Manager</span>
      <span className={approvalLabelClass(run.managerDecision)}>
        {run.managerDecision}
      </span>
    </div>
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">General Manager</span>
      <span className={approvalLabelClass(run.gmDecision)}>
        {run.gmDecision}
      </span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          getApprovalProgressClass(run),
        )}
        style={{ width: `${getApprovalProgress(run)}%` }}
      />
    </div>
  </div>
);

const PayrollReviewPage = () => {
  const { user, loading: sessionLoading } = useSession();

  const [runs, setRuns] = useState<PayrollRunSummary[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PayrollRunDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [working, setWorking] = useState(false);
  const [queueView, setQueueView] = useState<QueueView>("NEEDS_ACTION");
  const [typeFilter, setTypeFilter] = useState<"ALL" | PayrollTypeValue>("ALL");

  const canManagerReview = user?.role === "manager";
  const canGmReview = user?.role === "generalManager";

  const loadRuns = async () => {
    try {
      setLoadingRuns(true);
      setRunsError(null);
      const result = await listPayrollRuns({ limit: 60 });
      if (!result.success) {
        throw new Error(result.error || "Failed to load payroll review queue");
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
      setRunsError(
        err instanceof Error ? err.message : "Failed to load payroll review queue",
      );
    } finally {
      setLoadingRuns(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      void loadRuns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading]);

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
          throw new Error(result.error || "Failed to load payroll run");
        }
        setSelectedRun(result.data ?? null);
      } catch (err) {
        setSelectedRun(null);
        setDetailError(err instanceof Error ? err.message : "Failed to load payroll");
      } finally {
        setLoadingDetail(false);
      }
    };
    void loadDetail();
  }, [selectedRunId]);

  const pendingRuns = useMemo(
    () => runs.filter((run) => run.status !== "RELEASED"),
    [runs],
  );
  const releasedCount = useMemo(
    () => runs.filter((run) => run.status === "RELEASED").length,
    [runs],
  );
  const rejectedCount = useMemo(() => runs.filter(isReturnedRun).length, [runs]);

  const visibleRuns = useMemo(() => {
    return runs.filter((run) => {
      if (typeFilter !== "ALL" && run.payrollType !== typeFilter) {
        return false;
      }

      if (queueView === "RETURNED") {
        return isReturnedRun(run);
      }

      if (queueView === "RELEASED") {
        return run.status === "RELEASED";
      }

      if (queueView === "NEEDS_ACTION") {
        return isNeedsActionRun(run);
      }

      return true;
    });
  }, [queueView, runs, typeFilter]);

  useEffect(() => {
    if (visibleRuns.length === 0) {
      setSelectedRunId(null);
      return;
    }

    if (!selectedRunId || !visibleRuns.some((run) => run.payrollId === selectedRunId)) {
      setSelectedRunId(visibleRuns[0].payrollId);
    }
  }, [selectedRunId, visibleRuns]);

  const executeReview = async (
    level: "MANAGER" | "GENERAL_MANAGER",
    decision: "APPROVED" | "REJECTED",
  ) => {
    if (!selectedRunId) return;
    try {
      setWorking(true);
      setActionError(null);
      setActionSuccess(null);
      const result = await reviewPayrollRun({
        payrollId: selectedRunId,
        level,
        decision,
        remarks: reviewRemarks,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to review payroll run");
      }
      setActionSuccess("Payroll review updated.");
      setReviewRemarks("");
      setSelectedRun(result.data ?? null);
      await loadRuns();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to review payroll run",
      );
    } finally {
      setWorking(false);
    }
  };

  const handleRelease = async () => {
    if (!selectedRunId) return;
    try {
      setWorking(true);
      setActionError(null);
      setActionSuccess(null);
      const result = await releasePayrollRun(selectedRunId);
      if (!result.success) {
        throw new Error(result.error || "Failed to release payroll run");
      }
      setActionSuccess("Payroll run released.");
      setSelectedRun(result.data ?? null);
      await loadRuns();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to release payroll run",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div>
        <h1 className="text-2xl font-semibold">Review Payroll</h1>
        <p className="text-sm text-muted-foreground">
          General Manager approval and release flow for manager-prepared payroll runs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{pendingRuns.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Released
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{releasedCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Returned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Review Queue</CardTitle>
              <p className="text-sm text-muted-foreground">
                Needs Action now keeps approved `REVIEWED` runs visible until they
                are released.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadRuns()}>
              Refresh
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={queueView === "NEEDS_ACTION" ? "default" : "outline"}
              onClick={() => setQueueView("NEEDS_ACTION")}
            >
              Needs Action
            </Button>
            <Button
              type="button"
              size="sm"
              variant={queueView === "RETURNED" ? "default" : "outline"}
              onClick={() => setQueueView("RETURNED")}
            >
              Returned
            </Button>
            <Button
              type="button"
              size="sm"
              variant={queueView === "RELEASED" ? "default" : "outline"}
              onClick={() => setQueueView("RELEASED")}
            >
              Released
            </Button>
            <Button
              type="button"
              size="sm"
              variant={queueView === "ALL" ? "default" : "outline"}
              onClick={() => setQueueView("ALL")}
            >
              All
            </Button>
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as "ALL" | PayrollTypeValue)
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="ALL">All types</option>
              <option value="BIMONTHLY">Bi-monthly</option>
              <option value="OFF_CYCLE">Off-cycle</option>
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingRuns ? (
            <InlineLoadingState label="Loading payroll queue" lines={3} />
          ) : null}
          {!loadingRuns && runsError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {runsError}
            </div>
          ) : null}
          {!loadingRuns && !runsError && visibleRuns.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No payroll runs found for this queue view.
            </div>
          ) : null}
          {!loadingRuns && !runsError
            ? visibleRuns.map((run) => {
                const selected = selectedRunId === run.payrollId;
                const readyForRelease = isReadyForRelease(run);

                return (
                  <button
                    key={run.payrollId}
                    type="button"
                    onClick={() => setSelectedRunId(run.payrollId)}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-colors",
                      "hover:border-primary/40 hover:bg-primary/5",
                      selected && "border-primary bg-primary/5 shadow-sm",
                    )}
                  >
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(260px,0.9fr)] xl:items-start">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold leading-tight">
                            {formatDateRange(
                              run.payrollPeriodStart,
                              run.payrollPeriodEnd,
                            )}
                          </p>
                          {readyForRelease ? (
                            <span className="rounded-full border border-blue-600/40 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                              Ready To Release
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>
                            {run.createdByName
                              ? `Created by ${run.createdByName}`
                              : "System generated"}
                          </span>
                          <span>Generated {formatDateTime(run.generatedAt)}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="outline"
                            className={payrollTypeClass(run.payrollType)}
                          >
                            {humanizePayrollType(run.payrollType)}
                          </Badge>
                          <Badge variant="outline" className={statusClass(run.status)}>
                            {run.status}
                          </Badge>
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                          <span>{run.employeeCount} employees</span>
                          <span>Net {formatCurrency(run.netTotal)}</span>
                        </div>
                      </div>

                      <div className="rounded-lg border bg-muted/20 p-3">
                        <ApprovalCell run={run} className="min-w-0" />
                      </div>
                    </div>
                  </button>
                );
              })
            : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Review Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedRun ? (
            <p className="text-sm text-muted-foreground">
              Select a payroll run to review.
            </p>
          ) : (
            <>
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold">
                    {formatDateRange(
                      selectedRun.payrollPeriodStart,
                      selectedRun.payrollPeriodEnd,
                    )}
                  </p>
                  {isReadyForRelease(selectedRun) ? (
                    <span className="rounded-full border border-blue-600/40 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                      Ready To Release
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {humanizePayrollType(selectedRun.payrollType)} · {selectedRun.employeeCount}{" "}
                  employees · Net {formatCurrency(selectedRun.netTotal)}
                </p>
              </div>

              {(selectedRun.managerDecision === "REJECTED" ||
                selectedRun.gmDecision === "REJECTED") && (
                <div className="rounded-lg border border-orange-300/70 bg-orange-50/60 p-3 text-sm text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-200">
                  <p className="font-medium">Returned To Manager</p>
                  <p>
                    This run is back in draft due to rejection. The manager can
                    regenerate it from Generate Payroll before review continues.
                  </p>
                </div>
              )}

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Review remarks</p>
                  <Input
                    value={reviewRemarks}
                    onChange={(event) => setReviewRemarks(event.target.value)}
                    placeholder="Add remarks (required on reject)"
                  />
                  {actionSuccess ? (
                    <p className="text-sm text-emerald-700">{actionSuccess}</p>
                  ) : null}
                  {actionError ? (
                    <p className="text-sm text-destructive">{actionError}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {canManagerReview ? (
                    <>
                      <Button
                        type="button"
                        disabled={working}
                        onClick={() => void executeReview("MANAGER", "APPROVED")}
                      >
                        Manager Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={working}
                        onClick={() => void executeReview("MANAGER", "REJECTED")}
                      >
                        Manager Reject
                      </Button>
                    </>
                  ) : null}

                  {canGmReview ? (
                    <>
                      <Button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          void executeReview("GENERAL_MANAGER", "APPROVED")
                        }
                      >
                        GM Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={working}
                        onClick={() =>
                          void executeReview("GENERAL_MANAGER", "REJECTED")
                        }
                      >
                        GM Reject
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={working}
                        onClick={() => void handleRelease()}
                      >
                        Release Payroll
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </>
          )}
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

export default PayrollReviewPage;
