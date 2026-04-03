"use client";

import { useEffect, useMemo, useState } from "react";
import { getPayrollEmployeeAttendance } from "@/actions/payroll/payroll-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  InlineLoadingState,
  TableLoadingState,
} from "@/components/loading/loading-states";
import { cn } from "@/lib/utils";
import type {
  PayrollEmployeeAttendanceRow,
  PayrollEmployeeDetail,
  PayrollRunDetail,
} from "@/types/payroll";
import {
  decisionClass,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatMinutes,
  humanizePayrollType,
  statusClass,
} from "./payroll-ui-helpers";

type PayrollRunDetailsCardProps = {
  run: PayrollRunDetail | null;
  loading?: boolean;
  error?: string | null;
  title?: string;
};

type EmployeeModalState =
  | {
      mode: "attendance" | "deductions" | "earnings";
      employee: PayrollEmployeeDetail;
    }
  | null;

type ApprovalStepState = "DONE" | "ACTIVE" | "PENDING" | "REJECTED";
type ApprovalStep = {
  key: "MANAGER" | "GENERAL_MANAGER";
  label: string;
  state: ApprovalStepState;
  description: string;
};

const formatClockMinutes = (minutes: number | null | undefined) => {
  if (minutes == null) return "—";
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours24 = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${mins.toString().padStart(2, "0")} ${suffix}`;
};

const statusBadgeClass = (status: string) =>
  cn(
    "border",
    status === "PRESENT" && "border-emerald-600 text-emerald-700",
    status === "LATE" && "border-orange-600 text-orange-700",
    status === "ABSENT" && "border-destructive text-destructive",
    status === "REST" && "border-slate-500 text-slate-700",
    status === "INCOMPLETE" && "border-slate-500 text-slate-700",
  );

const sourceClass = (source: string) =>
  cn(
    "border",
    source === "SYSTEM" && "border-sky-600 text-sky-700",
    source === "CONTRIBUTION_ENGINE" && "border-emerald-600 text-emerald-700",
    source === "MANUAL" && "border-orange-600 text-orange-700",
    source === "IMPORT" && "border-violet-600 text-violet-700",
  );

const deductionLabel = (line: PayrollEmployeeDetail["deductions"][number]) =>
  line.deductionNameSnapshot ??
  line.deductionCodeSnapshot ??
  line.deductionType;

const earningLabel = (line: PayrollEmployeeDetail["earnings"][number]) =>
  line.earningType;

const approvalStateLabel = (state: ApprovalStepState) => {
  if (state === "DONE") return "Completed";
  if (state === "ACTIVE") return "In progress";
  if (state === "REJECTED") return "Rejected";
  return "Pending";
};

const approvalStateClass = (state: ApprovalStepState) =>
  cn(
    "border",
    state === "DONE" && "border-emerald-600 text-emerald-700",
    state === "ACTIVE" && "border-sky-600 text-sky-700",
    state === "PENDING" && "border-muted-foreground/40 text-muted-foreground",
    state === "REJECTED" && "border-destructive text-destructive",
  );

const computeApprovalFlow = (run: PayrollRunDetail) => {
  const managerApproved = run.managerDecision === "APPROVED";
  const managerRejected = run.managerDecision === "REJECTED";
  const gmApproved = run.gmDecision === "APPROVED";
  const gmRejected = run.gmDecision === "REJECTED";

  const steps: ApprovalStep[] = [
    {
      key: "MANAGER",
      label: "Manager",
      state: managerRejected
        ? "REJECTED"
        : managerApproved
          ? "DONE"
          : "ACTIVE",
      description: managerRejected
        ? "Returned for manager revision"
        : managerApproved
          ? `Prepared ${formatDate(run.managerReviewedAt ?? run.generatedAt)}`
          : "Manager is still preparing this run",
    },
    {
      key: "GENERAL_MANAGER",
      label: "General Manager",
      state: managerRejected
        ? "PENDING"
        : gmRejected
          ? "REJECTED"
          : gmApproved
            ? "DONE"
            : managerApproved
              ? "ACTIVE"
              : "PENDING",
      description: managerRejected
        ? "Waiting for manager regeneration"
        : gmRejected
          ? "Rejected by general manager"
          : gmApproved
            ? `Approved ${formatDate(run.gmReviewedAt)}`
            : managerApproved
              ? "Awaiting GM review"
              : "Blocked until manager finishes preparation",
    },
  ];

  const completedCount =
    (managerApproved ? 1 : 0) + (managerApproved && gmApproved ? 1 : 0);
  const percent = Math.round((completedCount / steps.length) * 100);
  const hasRejected = managerRejected || gmRejected;

  return {
    steps,
    percent,
    hasRejected,
  };
};

const PayrollRunDetailsCard = ({
  run,
  loading,
  error,
  title = "Payroll Run Details",
}: PayrollRunDetailsCardProps) => {
  const [modalState, setModalState] = useState<EmployeeModalState>(null);
  const [attendanceRows, setAttendanceRows] = useState<
    PayrollEmployeeAttendanceRow[]
  >([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const openedEmployee = modalState?.employee ?? null;
  const isAttendanceModal = modalState?.mode === "attendance";
  const isDeductionsModal = modalState?.mode === "deductions";
  const isEarningsModal = modalState?.mode === "earnings";

  useEffect(() => {
    const loadAttendance = async () => {
      if (!openedEmployee || !isAttendanceModal) {
        setAttendanceRows([]);
        setAttendanceError(null);
        setAttendanceLoading(false);
        return;
      }

      try {
        setAttendanceLoading(true);
        setAttendanceError(null);
        const result = await getPayrollEmployeeAttendance(openedEmployee.id);
        if (!result.success) {
          throw new Error(result.error || "Failed to load attendance breakdown");
        }
        setAttendanceRows(result.data ?? []);
      } catch (err) {
        setAttendanceRows([]);
        setAttendanceError(
          err instanceof Error
            ? err.message
            : "Failed to load attendance breakdown",
        );
      } finally {
        setAttendanceLoading(false);
      }
    };

    void loadAttendance();
  }, [openedEmployee, isAttendanceModal]);

  const attendanceTotals = useMemo(
    () =>
      attendanceRows.reduce(
        (acc, row) => {
          acc.worked += Math.max(0, row.workedMinutes ?? 0);
          acc.net += Math.max(0, row.netWorkedMinutes ?? 0);
          acc.ot += Math.max(0, row.overtimeMinutes ?? 0);
          acc.ut += Math.max(0, row.undertimeMinutes ?? 0);
          return acc;
        },
        { worked: 0, net: 0, ot: 0, ut: 0 },
      ),
    [attendanceRows],
  );

  const deductionSummary = useMemo(() => {
    if (!openedEmployee) {
      return {
        lines: 0,
        manual: 0,
        total: 0,
      };
    }
    return {
      lines: openedEmployee.deductions.length,
      manual: openedEmployee.deductions.filter((line) => line.isManual).length,
      total: openedEmployee.deductions.reduce((sum, line) => sum + line.amount, 0),
    };
  }, [openedEmployee]);

  const approvalFlow = useMemo(
    () => (run ? computeApprovalFlow(run) : null),
    [run],
  );

  return (
    <>
      <Card className="rounded-2xl border border-border/70 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-b from-muted/15 to-background">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <InlineLoadingState
              label="Loading details"
              lines={3}
              className="border-border/60 bg-muted/10"
            />
          ) : null}
          {!loading && error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {!loading && !error && !run ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Select a payroll run to inspect employee-level totals and line items.
            </div>
          ) : null}

          {!loading && !error && run ? (
            <>
              <div className="space-y-6 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/15 p-5 sm:p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={statusClass(run.status)}>
                        {run.status}
                      </Badge>
                      <Badge variant="outline" className={decisionClass(run.managerDecision)}>
                        Manager: {run.managerDecision}
                      </Badge>
                      <Badge variant="outline" className={decisionClass(run.gmDecision)}>
                        GM: {run.gmDecision}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        Payroll Period
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                        {formatDateRange(run.payrollPeriodStart, run.payrollPeriodEnd)}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Generated {formatDateTime(run.generatedAt)}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Type
                      </p>
                      <p className="mt-2 text-base font-semibold tracking-tight">
                        {humanizePayrollType(run.payrollType)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Employees
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight">
                        {run.employeeCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Gross
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight">
                        {formatCurrency(run.grossTotal)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Net
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight">
                        {formatCurrency(run.netTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {approvalFlow ? (
                <div className="space-y-3 rounded-xl border border-border/70 bg-background/85 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Approval Progress (Manager → General Manager)
                    </p>
                    <span className="text-xs font-medium text-muted-foreground">
                      {approvalFlow.percent}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full transition-all",
                        approvalFlow.hasRejected
                          ? "bg-destructive"
                          : approvalFlow.percent === 100
                            ? "bg-emerald-600"
                            : "bg-primary",
                      )}
                      style={{ width: `${approvalFlow.percent}%` }}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {approvalFlow.steps.map((step) => (
                      <div
                        key={step.key}
                        className="rounded-xl border border-border/70 bg-muted/15 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{step.label}</p>
                          <Badge
                            variant="outline"
                            className={approvalStateClass(step.state)}
                          >
                            {approvalStateLabel(step.state)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {run.managerReviewRemarks ? (
                <div className="rounded-2xl border border-orange-300/70 bg-orange-50/60 p-4 text-sm text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-200">
                  <p className="font-medium">Manager Remarks</p>
                  <p>{run.managerReviewRemarks}</p>
                </div>
              ) : null}
              {run.gmReviewRemarks ? (
                <div className="rounded-2xl border border-orange-300/70 bg-orange-50/60 p-4 text-sm text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-200">
                  <p className="font-medium">General Manager Remarks</p>
                  <p>{run.gmReviewRemarks}</p>
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background/85">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Days (P/A/L)</TableHead>
                      <TableHead>Hours Worked</TableHead>
                      <TableHead>OT</TableHead>
                      <TableHead>UT</TableHead>
                      <TableHead>Earnings</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.employees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-muted-foreground">
                          No payroll employees found for this run.
                        </TableCell>
                      </TableRow>
                    ) : (
                      run.employees.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.employeeName}
                            <p className="text-xs text-muted-foreground">
                              {row.employeeCode}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs">
                              <Badge variant="outline">P {row.daysPresent}</Badge>
                              <Badge variant="outline">A {row.daysAbsent}</Badge>
                              <Badge variant="outline">L {row.daysLate}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-left"
                              onClick={() =>
                                setModalState({
                                  mode: "attendance",
                                  employee: row,
                                })
                              }
                            >
                              {formatMinutes(row.minutesNetWorked)}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              Gross {formatMinutes(row.minutesWorked)}
                            </p>
                          </TableCell>
                          <TableCell>{formatMinutes(row.minutesOvertime)}</TableCell>
                          <TableCell>{formatMinutes(row.minutesUndertime)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-left"
                              onClick={() =>
                                setModalState({
                                  mode: "earnings",
                                  employee: row,
                                })
                              }
                            >
                              {formatCurrency(row.totalEarnings)}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              {row.earnings.length} line(s)
                            </p>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-left"
                              onClick={() =>
                                setModalState({
                                  mode: "deductions",
                                  employee: row,
                                })
                              }
                            >
                              {formatCurrency(row.totalDeductions)}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              {row.deductions.length} line(s)
                            </p>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(row.netPay)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(modalState)}
        onOpenChange={(open) => {
          if (!open) {
            setModalState(null);
          }
        }}
      >
        <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[94vw] lg:max-w-[1200px] xl:max-w-[1400px] 2xl:max-w-[1600px] max-h-[90vh] overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {isAttendanceModal
                ? "Attendance Breakdown"
                : isDeductionsModal
                  ? "Deduction Breakdown"
                  : "Earning Breakdown"}
              {openedEmployee ? ` · ${openedEmployee.employeeName}` : ""}
            </DialogTitle>
          </DialogHeader>

          {openedEmployee ? (
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Period
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {formatDateRange(
                      openedEmployee.attendanceStart,
                      openedEmployee.attendanceEnd,
                    )}
                  </p>
                </div>

                {isAttendanceModal ? (
                  <>
                    <div className="rounded-lg border bg-muted/20 p-3 lg:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Net Worked
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {formatMinutes(attendanceTotals.net)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Overtime
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {formatMinutes(attendanceTotals.ot)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Undertime
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {formatMinutes(attendanceTotals.ut)}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg border bg-muted/20 p-3 lg:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {isDeductionsModal ? "Total Deductions" : "Total Earnings"}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {formatCurrency(
                          isDeductionsModal
                            ? deductionSummary.total
                            : openedEmployee.earnings.reduce(
                                (sum, line) => sum + line.amount,
                                0,
                              ),
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Lines
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {isDeductionsModal
                          ? deductionSummary.lines
                          : openedEmployee.earnings.length}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Manual Lines
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {isDeductionsModal
                          ? deductionSummary.manual
                          : openedEmployee.earnings.filter((line) => line.isManual)
                              .length}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {isAttendanceModal ? (
                <>
                  {attendanceLoading ? (
                    <TableLoadingState
                      label="Loading attendance rows"
                      columns={5}
                      rows={4}
                    />
                  ) : null}
                  {!attendanceLoading && attendanceError ? (
                    <p className="text-sm text-destructive">{attendanceError}</p>
                  ) : null}
                  {!attendanceLoading && !attendanceError ? (
                    <div className="max-h-[24rem] overflow-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Shift</TableHead>
                            <TableHead>Actual In</TableHead>
                            <TableHead>Actual Out</TableHead>
                            <TableHead>Worked</TableHead>
                            <TableHead>Net</TableHead>
                            <TableHead>Late</TableHead>
                            <TableHead>UT</TableHead>
                            <TableHead>OT</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendanceRows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={10}
                                className="text-muted-foreground"
                              >
                                No attendance rows linked to this payroll employee.
                              </TableCell>
                            </TableRow>
                          ) : (
                            attendanceRows.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="whitespace-nowrap">
                                  {formatDate(row.workDate)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={statusBadgeClass(row.status)}
                                  >
                                    {row.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <p>{row.expectedShiftName ?? "No shift"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatClockMinutes(row.scheduledStartMinutes)} -{" "}
                                    {formatClockMinutes(row.scheduledEndMinutes)}
                                  </p>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {formatDateTime(row.actualInAt)}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {formatDateTime(row.actualOutAt)}
                                </TableCell>
                                <TableCell>
                                  {formatMinutes(row.workedMinutes ?? 0)}
                                </TableCell>
                                <TableCell>
                                  {formatMinutes(row.netWorkedMinutes ?? 0)}
                                </TableCell>
                                <TableCell>{formatMinutes(row.lateMinutes)}</TableCell>
                                <TableCell>
                                  {formatMinutes(row.undertimeMinutes)}
                                </TableCell>
                                <TableCell>{formatMinutes(row.overtimeMinutes)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </>
              ) : null}

              {isDeductionsModal ? (
                <div className="max-h-[24rem] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Minutes</TableHead>
                        <TableHead>Rate Snapshot</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openedEmployee.deductions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-muted-foreground">
                            No deductions found for this employee.
                          </TableCell>
                        </TableRow>
                      ) : (
                        openedEmployee.deductions.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium">
                              {deductionLabel(line)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={sourceClass(line.source)}>
                                {line.source}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(line.amount)}</TableCell>
                            <TableCell>
                              {line.minutes != null
                                ? formatMinutes(line.minutes)
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {line.rateSnapshot != null
                                ? line.rateSnapshot.toFixed(6)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {line.remarks || "No remarks"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {isEarningsModal ? (
                <div className="max-h-[24rem] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Minutes</TableHead>
                        <TableHead>Rate Snapshot</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openedEmployee.earnings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-muted-foreground">
                            No earnings found for this employee.
                          </TableCell>
                        </TableRow>
                      ) : (
                        openedEmployee.earnings.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium">
                              {earningLabel(line)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={sourceClass(line.source)}>
                                {line.source}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(line.amount)}</TableCell>
                            <TableCell>
                              {line.minutes != null
                                ? formatMinutes(line.minutes)
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {line.rateSnapshot != null
                                ? line.rateSnapshot.toFixed(6)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {line.remarks || "No remarks"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PayrollRunDetailsCard;
