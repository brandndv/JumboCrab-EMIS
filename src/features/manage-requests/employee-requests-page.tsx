"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getEmployeeDayOffMonthlySummary,
  getEmployeeLeaveBalanceSummary,
  listCashAdvanceRequests,
  listDayOffRequests,
  listGovernmentLoanAssistanceRequests,
  listLeaveRequests,
  listSilEncashmentRequests,
  listScheduleChangeRequests,
  listScheduleSwapRequests,
  respondToScheduleSwapRequest,
  type CashAdvanceRequestRow,
  type DayOffRequestRow,
  type EmployeeDayOffMonthlySummary,
  type EmployeeLeaveBalanceSummary,
  type GovernmentLoanAssistanceRequestRow,
  type LeaveRequestRow,
  type SilEncashmentRequestRow,
  type ScheduleChangeRequestRow,
  type ScheduleSwapRequestRow,
} from "@/actions/requests/requests-action";
import {
  formatDate,
  formatDateRange,
  formatMoney,
  leaveTypeLabel,
  linkedDeductionStatusLabel,
  requestStatusClass,
  requestStatusLabel,
  requestTypeLabel,
} from "@/features/manage-requests/request-ui-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleLoadingState } from "@/components/loading/loading-states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";

type EmployeeRequestsPageProps = {
  view?: "all" | "leave" | "day-off";
};

type RequestRow =
  | ({ requestType: "CASH_ADVANCE" } & CashAdvanceRequestRow)
  | ({ requestType: "GOVERNMENT_LOAN" } & GovernmentLoanAssistanceRequestRow)
  | ({ requestType: "SIL_ENCASHMENT" } & SilEncashmentRequestRow)
  | ({ requestType: "LEAVE" } & LeaveRequestRow)
  | ({ requestType: "DAY_OFF" } & DayOffRequestRow)
  | ({ requestType: "SCHEDULE_CHANGE" } & ScheduleChangeRequestRow)
  | ({ requestType: "SCHEDULE_SWAP" } & ScheduleSwapRequestRow);

const checklistToneClass = (status: string) => {
  if (status === "DONE") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "CURRENT") {
    return "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300";
  }
  if (status === "BLOCKED") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  return "border-border/70 bg-muted/20 text-muted-foreground";
};

const checklistStatusLabel = (status: string) =>
  status === "DONE"
    ? "Done"
    : status === "CURRENT"
      ? "Now"
      : status === "BLOCKED"
        ? "Blocked"
        : "Pending";

export default function EmployeeRequestsPage({
  view = "all",
}: EmployeeRequestsPageProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaveSummary, setLeaveSummary] = useState<EmployeeLeaveBalanceSummary | null>(
    null,
  );
  const [leaveYearSummaries, setLeaveYearSummaries] = useState<
    EmployeeLeaveBalanceSummary[]
  >([]);
  const [dayOffSummary, setDayOffSummary] = useState<EmployeeDayOffMonthlySummary | null>(
    null,
  );
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [swapRemarks, setSwapRemarks] = useState<Record<string, string>>({});
  const [respondingKey, setRespondingKey] = useState<string | null>(null);

  const isLeaveView = view === "leave";
  const isDayOffView = view === "day-off";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isLeaveView) {
        const year = new Date().getFullYear();
        const [summaryResult, silEncashmentResult, leaveResult, ...historyResults] = await Promise.all([
          getEmployeeLeaveBalanceSummary(),
          listSilEncashmentRequests(),
          listLeaveRequests(),
          getEmployeeLeaveBalanceSummary({ year }),
          getEmployeeLeaveBalanceSummary({ year: year - 1 }),
          getEmployeeLeaveBalanceSummary({ year: year - 2 }),
        ]);
        if (!summaryResult.success) {
          throw new Error(summaryResult.error || "Failed to load leave credits.");
        }
        if (!silEncashmentResult.success) {
          throw new Error(
            silEncashmentResult.error || "Failed to load SIL encashment requests.",
          );
        }
        if (!leaveResult.success) {
          throw new Error(leaveResult.error || "Failed to load leave requests.");
        }
        const history = historyResults
          .filter((result) => result.success && result.data)
          .map((result) => result.data!)
          .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        setLeaveSummary(summaryResult.data ?? null);
        setLeaveYearSummaries(history);
        setDayOffSummary(null);
        setRows([
          ...(silEncashmentResult.data ?? []).map((row) => ({
            ...row,
            requestType: "SIL_ENCASHMENT" as const,
          })),
          ...(leaveResult.data ?? []).map((row) => ({
            ...row,
            requestType: "LEAVE" as const,
          })),
        ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
        return;
      }

      if (isDayOffView) {
        const [summaryResult, dayOffResult] = await Promise.all([
          getEmployeeDayOffMonthlySummary(),
          listDayOffRequests(),
        ]);
        if (!summaryResult.success) {
          throw new Error(summaryResult.error || "Failed to load day off summary.");
        }
        if (!dayOffResult.success) {
          throw new Error(dayOffResult.error || "Failed to load change day off requests.");
        }
        setLeaveSummary(null);
        setLeaveYearSummaries([]);
        setDayOffSummary(summaryResult.data ?? null);
        setRows((dayOffResult.data ?? []).map((row) => ({ ...row, requestType: "DAY_OFF" })));
        return;
      }

      const [cash, governmentLoan, silEncashment, leave, dayOff, change, swap] = await Promise.all([
        listCashAdvanceRequests(),
        listGovernmentLoanAssistanceRequests(),
        listSilEncashmentRequests(),
        listLeaveRequests(),
        listDayOffRequests(),
        listScheduleChangeRequests(),
        listScheduleSwapRequests(),
      ]);

      if (!cash.success) throw new Error(cash.error || "Failed to load cash advances.");
      if (!governmentLoan.success) {
        throw new Error(
          governmentLoan.error || "Failed to load government loan assistance requests.",
        );
      }
      if (!silEncashment.success) {
        throw new Error(
          silEncashment.error || "Failed to load SIL encashment requests.",
        );
      }
      if (!leave.success) throw new Error(leave.error || "Failed to load leave requests.");
      if (!dayOff.success) throw new Error(dayOff.error || "Failed to load change day off requests.");
      if (!change.success) throw new Error(change.error || "Failed to load change shift requests.");
      if (!swap.success) throw new Error(swap.error || "Failed to load shift swaps.");

      setLeaveSummary(null);
      setLeaveYearSummaries([]);
      setDayOffSummary(null);
      setRows([
        ...(cash.data ?? []).map((row) => ({ ...row, requestType: "CASH_ADVANCE" as const })),
        ...(governmentLoan.data ?? []).map((row) => ({
          ...row,
          requestType: "GOVERNMENT_LOAN" as const,
        })),
        ...(silEncashment.data ?? []).map((row) => ({
          ...row,
          requestType: "SIL_ENCASHMENT" as const,
        })),
        ...(leave.data ?? []).map((row) => ({ ...row, requestType: "LEAVE" as const })),
        ...(dayOff.data ?? []).map((row) => ({ ...row, requestType: "DAY_OFF" as const })),
        ...(change.data ?? []).map((row) => ({ ...row, requestType: "SCHEDULE_CHANGE" as const })),
        ...(swap.data ?? []).map((row) => ({ ...row, requestType: "SCHEDULE_SWAP" as const })),
      ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
    } catch (err) {
      setRows([]);
      setLeaveSummary(null);
      setLeaveYearSummaries([]);
      setDayOffSummary(null);
      setError(err instanceof Error ? err.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, [isDayOffView, isLeaveView]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingIncomingSwaps = useMemo(
    () =>
      rows.filter(
        (row): row is Extract<RequestRow, { requestType: "SCHEDULE_SWAP" }> =>
          row.requestType === "SCHEDULE_SWAP" &&
          row.isIncomingToViewer &&
          row.status === "PENDING_COWORKER",
      ),
    [rows],
  );
  const pendingCount = useMemo(
    () => rows.filter((row) => row.status.startsWith("PENDING")).length,
    [rows],
  );
  const approvedCount = useMemo(
    () =>
      rows.filter((row) =>
        ["APPROVED", "APPROVED_BY_AGENCY", "RECORDED_IN_PAYROLL"].includes(
          row.status,
        ),
      ).length,
    [rows],
  );
  const rejectedCount = useMemo(
    () =>
      rows.filter((row) =>
        ["REJECTED", "DECLINED", "DECLINED_BY_AGENCY", "CANCELLED"].includes(
          row.status,
        ),
      ).length,
    [rows],
  );

  const handleSwapResponse = async (
    row: Extract<RequestRow, { requestType: "SCHEDULE_SWAP" }>,
    decision: "ACCEPTED" | "DECLINED",
  ) => {
    try {
      setRespondingKey(`${row.id}:${decision}`);
      const result = await respondToScheduleSwapRequest({
        id: row.id,
        decision,
        coworkerRemarks: swapRemarks[row.id] ?? "",
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to respond to swap.");
      }
      toast.success(
        decision === "ACCEPTED" ? "Swap accepted" : "Swap declined",
        {
          description: "Your response was saved.",
        },
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to respond to swap.");
    } finally {
      setRespondingKey(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {isLeaveView
              ? "Leave Credits"
              : isDayOffView
                ? "Change Day Off Requests"
                : "My Requests"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLeaveView
              ? "Sick, SIL, and unpaid leave only. Legacy leave types stay hidden here."
              : isDayOffView
                ? "Track upcoming day-off transfer requests."
                : "Track leave, schedule, cash advance, and government loan assistance requests."}
          </p>
        </div>
          <Button asChild className="w-full sm:w-auto">
            <Link href={isLeaveView ? "/employee/requests/leave" : "/employee/requests/add"}>
              {isLeaveView ? "New Leave Request" : "New Request"}
            </Link>
          </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Closed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      {isLeaveView && leaveSummary ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sick Leave</p>
              <p className="mt-2 text-3xl font-semibold">{leaveSummary.sick.remaining}</p>
              <p className="text-sm text-muted-foreground">
                Used {leaveSummary.sick.used} of {leaveSummary.sick.annualCredits}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Service Incentive Leave</p>
              <p className="mt-2 text-3xl font-semibold">{leaveSummary.sil.remaining}</p>
              <p className="text-sm text-muted-foreground">
                Used {leaveSummary.sil.used} of {leaveSummary.sil.annualCredits}
              </p>
            </CardContent>
          </Card>
          {leaveYearSummaries.length > 0 ? (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Leave Credits by Year</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  {leaveYearSummaries.map((summary) => (
                    <div
                      key={summary.year}
                      className="rounded-xl border border-border/70 p-4 text-sm"
                    >
                      <p className="font-medium">{summary.year}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            Sick
                          </p>
                          <p className="mt-1 font-medium">
                            Used {summary.sick.used}
                          </p>
                          <p className="text-muted-foreground">
                            Remaining {summary.sick.remaining} of{" "}
                            {summary.sick.annualCredits}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            SIL
                          </p>
                          <p className="mt-1 font-medium">
                            Used {summary.sil.used}
                          </p>
                          <p className="text-muted-foreground">
                            Remaining {summary.sil.remaining} of{" "}
                            {summary.sil.annualCredits}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {isDayOffView && dayOffSummary ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">This month</p>
            <p className="mt-2 text-3xl font-semibold">{dayOffSummary.approvedThisMonth}</p>
            <p className="text-sm text-muted-foreground">
              Approved change day off requests in {dayOffSummary.monthLabel}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {pendingIncomingSwaps.length > 0 ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Awaiting Your Swap Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingIncomingSwaps.map((row) => (
              <div key={row.id} className="rounded-xl border border-border/70 p-4">
                <p className="font-medium">
                  {formatDate(row.workDate)} · {row.requesterEmployeeName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Their shift: {row.requesterShiftLabel}
                </p>
                <p className="text-sm text-muted-foreground">
                  Your shift: {row.coworkerShiftLabel}
                </p>
                <Textarea
                  className="mt-3"
                  rows={3}
                  placeholder="Remarks if needed"
                  value={swapRemarks[row.id] ?? ""}
                  onChange={(event) =>
                    setSwapRemarks((current) => ({
                      ...current,
                      [row.id]: event.target.value,
                    }))
                  }
                />
                <div className="mt-3 flex gap-2">
                  <Button
                    disabled={respondingKey === `${row.id}:ACCEPTED`}
                    onClick={() => void handleSwapResponse(row, "ACCEPTED")}
                  >
                    Accept
                  </Button>
                  <Button
                    disabled={respondingKey === `${row.id}:DECLINED`}
                    variant="outline"
                    onClick={() => void handleSwapResponse(row, "DECLINED")}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Request History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ModuleLoadingState
              title="Loading requests"
              description="Fetching your request history and pending actions."
            />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={`${row.requestType}:${row.id}`}
                  className="rounded-xl border border-border/70 bg-background p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{requestTypeLabel(row.requestType)}</p>
                        <Badge variant="outline" className={requestStatusClass(row.status)}>
                          {requestStatusLabel(row.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Submitted {formatDate(row.submittedAt)}
                      </p>
                    </div>
                  </div>

                  {row.requestType === "LEAVE" ? (
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="font-medium">{leaveTypeLabel(row.leaveType)}</p>
                      <p className="text-muted-foreground">
                        {formatDateRange(row.startDate, row.endDate)} · {row.totalDays} day(s)
                      </p>
                    </div>
                  ) : null}

                  {row.requestType === "SIL_ENCASHMENT" ? (
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="font-medium">
                        {row.days} SIL day(s) for encashment
                      </p>
                      <p className="text-muted-foreground">
                        {row.status === "APPROVED"
                          ? "Approved and deducted from SIL credits."
                          : row.status === "REJECTED"
                            ? "Rejected by manager."
                            : "Waiting for manager approval."}
                      </p>
                    </div>
                  ) : null}

                  {row.requestType === "DAY_OFF" ? (
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="text-muted-foreground">
                        Move OFF from {formatDate(row.sourceOffDate)} to {formatDate(row.targetWorkDate)}
                      </p>
                      <p className="text-muted-foreground">
                        Source: {row.sourceShiftLabel} · Target: {row.targetShiftLabel}
                      </p>
                    </div>
                  ) : null}

                  {row.requestType === "SCHEDULE_CHANGE" ? (
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="text-muted-foreground">
                        {formatDateRange(row.startDate, row.endDate)} · {row.totalDays} day(s)
                      </p>
                      <p className="text-muted-foreground">
                        Replace with {row.requestedShiftLabel}
                      </p>
                    </div>
                  ) : null}

                  {row.requestType === "SCHEDULE_SWAP" ? (
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="text-muted-foreground">
                        {formatDate(row.workDate)} · {row.coworkerEmployeeName}
                      </p>
                      <p className="text-muted-foreground">
                        Your shift: {row.requesterShiftLabel}
                      </p>
                      <p className="text-muted-foreground">
                        Coworker shift: {row.coworkerShiftLabel}
                      </p>
                    </div>
                  ) : null}

                  {row.requestType === "CASH_ADVANCE" ? (
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="font-medium">{formatMoney(row.amount)}</p>
                      {row.status === "APPROVED" ? (
                        <p className="text-muted-foreground">
                          Approved {formatMoney(row.approvedAmount ?? row.amount)} ·{" "}
                          {row.approvedDeductionMode === "INSTALLMENTS"
                            ? `Installments ${formatMoney(row.approvedRepaymentPerPayroll ?? 0)}`
                            : "Full next payroll"}
                        </p>
                      ) : null}
                      {row.linkedDeductionStatus ? (
                        <p className="text-muted-foreground">
                          Linked deduction: {linkedDeductionStatusLabel(row.linkedDeductionStatus)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {row.requestType === "GOVERNMENT_LOAN" ? (
                    <div className="mt-3 space-y-3 text-sm">
                      <div>
                        <p className="font-medium">
                          {row.agencyLabel} · {formatMoney(row.requestedAmount)}
                        </p>
                        <p className="text-muted-foreground">
                          {row.termMonths} months · Est. monthly{" "}
                          {formatMoney(row.estimatedMonthlyDeduction)} · Est. per payroll{" "}
                          {formatMoney(row.estimatedPerPayrollDeduction)}
                        </p>
                      </div>
                      {row.approvedAmount ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-lg bg-muted/30 p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              Approved amount
                            </p>
                            <p className="mt-1 font-medium">
                              {formatMoney(row.approvedAmount)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/30 p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              Monthly payment
                            </p>
                            <p className="mt-1 font-medium">
                              {formatMoney(row.approvedMonthlyPayment ?? 0)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/30 p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              Repayment start
                            </p>
                            <p className="mt-1 font-medium">
                              {formatDate(row.repaymentStartDate)}
                            </p>
                          </div>
                        </div>
                      ) : null}
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                        Prerequisite complete: government ID verified from employee profile.
                      </div>
                      <div className="space-y-3">
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${row.checklistProgress}%` }}
                          />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          {row.checklist.map((item) => (
                            <div
                              key={item.key}
                              className={`rounded-lg border px-3 py-2 ${checklistToneClass(item.status)}`}
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">
                                {checklistStatusLabel(item.status)}
                              </p>
                              <p className="mt-1 text-xs leading-4">{item.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {row.linkedDeductionStatus ? (
                        <p className="text-muted-foreground">
                          Linked deduction:{" "}
                          {linkedDeductionStatusLabel(row.linkedDeductionStatus)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {"reason" in row && row.reason ? (
                    <p className="mt-3 text-sm text-muted-foreground">{row.reason}</p>
                  ) : null}
                  {row.requestType === "GOVERNMENT_LOAN" && row.employeeRemarks ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {row.employeeRemarks}
                    </p>
                  ) : null}
                  {row.managerRemarks ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Manager remarks: {row.managerRemarks}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
