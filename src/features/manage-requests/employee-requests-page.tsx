"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getEmployeeDayOffMonthlySummary,
  getEmployeeLeaveBalanceSummary,
  listCashAdvanceRequests,
  listDayOffRequests,
  listLeaveRequests,
  listScheduleChangeRequests,
  listScheduleSwapRequests,
  respondToScheduleSwapRequest,
  type CashAdvanceRequestRow,
  type DayOffRequestRow,
  type EmployeeDayOffMonthlySummary,
  type EmployeeLeaveBalanceSummary,
  type LeaveRequestRow,
  type ScheduleChangeRequestRow,
  type ScheduleSwapRequestRow,
} from "@/actions/requests/requests-action";
import {
  countDaysInclusive,
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
import { useToast } from "@/components/ui/toast-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EmployeeRequestItem =
  | {
      id: string;
      requestType: "CASH_ADVANCE";
      title: string;
      submittedAt: string;
      reviewedAt?: string | null;
      status: CashAdvanceRequestRow["status"];
      reason?: string | null;
      managerRemarks?: string | null;
      amount: number;
      repaymentPerPayroll: number;
      dateLabel: string;
      deductionAssignmentId?: string | null;
      linkedDeductionStatus?: CashAdvanceRequestRow["linkedDeductionStatus"];
      linkedDeductionEffectiveFrom?: string | null;
      linkedDeductionRemainingBalance?: number | null;
    }
  | {
      id: string;
      requestType: "LEAVE";
      title: string;
      submittedAt: string;
      reviewedAt?: string | null;
      status: LeaveRequestRow["status"];
      reason?: string | null;
      managerRemarks?: string | null;
      leaveType: LeaveRequestRow["leaveType"];
      leaveTypeLabel: string;
      durationLabel: string;
      dateLabel: string;
      totalDays: number;
      paidDaysCount: number;
      unpaidDaysCount: number;
      paidDateList: string[];
      unpaidDateList: string[];
    }
  | {
      id: string;
      requestType: "DAY_OFF";
      title: string;
      submittedAt: string;
      reviewedAt?: string | null;
      status: DayOffRequestRow["status"];
      reason?: string | null;
      managerRemarks?: string | null;
      dateLabel: string;
      currentShiftLabel: string;
    }
  | {
      id: string;
      requestType: "SCHEDULE_CHANGE";
      title: string;
      submittedAt: string;
      reviewedAt?: string | null;
      status: ScheduleChangeRequestRow["status"];
      reason?: string | null;
      managerRemarks?: string | null;
      dateLabel: string;
      currentShiftLabel: string;
      requestedShiftLabel: string;
    }
  | {
      id: string;
      requestType: "SCHEDULE_SWAP";
      title: string;
      submittedAt: string;
      reviewedAt?: string | null;
      status: ScheduleSwapRequestRow["status"];
      reason?: string | null;
      managerRemarks?: string | null;
      coworkerRemarks?: string | null;
      dateLabel: string;
      counterpartName: string;
      counterpartCode: string;
      yourShiftLabel: string;
      counterpartShiftLabel: string;
      isIncomingToViewer: boolean;
    };

type EmployeeRequestsPageProps = {
  view?: "all" | "leave" | "day-off";
};

export default function EmployeeRequestsPage({
  view = "all",
}: EmployeeRequestsPageProps) {
  const toast = useToast();
  const [cashAdvanceRows, setCashAdvanceRows] = useState<CashAdvanceRequestRow[]>(
    [],
  );
  const [dayOffRows, setDayOffRows] = useState<DayOffRequestRow[]>([]);
  const [leaveRows, setLeaveRows] = useState<LeaveRequestRow[]>([]);
  const [scheduleChangeRows, setScheduleChangeRows] = useState<
    ScheduleChangeRequestRow[]
  >([]);
  const [scheduleSwapRows, setScheduleSwapRows] = useState<
    ScheduleSwapRequestRow[]
  >([]);
  const [leaveBalanceSummary, setLeaveBalanceSummary] =
    useState<EmployeeLeaveBalanceSummary | null>(null);
  const [dayOffMonthlySummary, setDayOffMonthlySummary] =
    useState<EmployeeDayOffMonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swapResponseNotes, setSwapResponseNotes] = useState<
    Record<string, string>
  >({});
  const [respondingSwapKey, setRespondingSwapKey] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<EmployeeRequestItem | null>(null);
  const isLeaveStatusView = view === "leave";
  const isDayOffStatusView = view === "day-off";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isLeaveStatusView) {
        const [leaveResult, balanceResult] = await Promise.all([
          listLeaveRequests(),
          getEmployeeLeaveBalanceSummary(),
        ]);
        if (!leaveResult.success) {
          throw new Error(leaveResult.error || "Failed to load leave requests");
        }
        if (!balanceResult.success) {
          throw new Error(
            balanceResult.error || "Failed to load leave balances",
          );
        }

        setCashAdvanceRows([]);
        setDayOffRows([]);
        setLeaveRows(leaveResult.data ?? []);
        setScheduleChangeRows([]);
        setScheduleSwapRows([]);
        setLeaveBalanceSummary(balanceResult.data ?? null);
        setDayOffMonthlySummary(null);
      } else if (isDayOffStatusView) {
        const [dayOffResult, summaryResult] = await Promise.all([
          listDayOffRequests(),
          getEmployeeDayOffMonthlySummary(),
        ]);
        if (!dayOffResult.success) {
          throw new Error(dayOffResult.error || "Failed to load day off requests");
        }
        if (!summaryResult.success) {
          throw new Error(summaryResult.error || "Failed to load day off summary");
        }

        setCashAdvanceRows([]);
        setDayOffRows(dayOffResult.data ?? []);
        setLeaveRows([]);
        setScheduleChangeRows([]);
        setScheduleSwapRows([]);
        setLeaveBalanceSummary(null);
        setDayOffMonthlySummary(summaryResult.data ?? null);
      } else {
        const [cashResult, dayOffResult, leaveResult, changeResult, swapResult] =
          await Promise.all([
          listCashAdvanceRequests(),
          listDayOffRequests(),
          listLeaveRequests(),
          listScheduleChangeRequests(),
          listScheduleSwapRequests(),
          ]);

        if (!cashResult.success) {
          throw new Error(
            cashResult.error || "Failed to load cash advance requests",
          );
        }
        if (!dayOffResult.success) {
          throw new Error(dayOffResult.error || "Failed to load day off requests");
        }
        if (!leaveResult.success) {
          throw new Error(leaveResult.error || "Failed to load leave requests");
        }
        if (!swapResult.success) {
          throw new Error(
            swapResult.error || "Failed to load schedule swap requests",
          );
        }
        if (!changeResult.success) {
          throw new Error(
            changeResult.error || "Failed to load schedule change requests",
          );
        }

        setCashAdvanceRows(cashResult.data ?? []);
        setDayOffRows(dayOffResult.data ?? []);
        setLeaveRows(leaveResult.data ?? []);
        setScheduleChangeRows(changeResult.data ?? []);
        setScheduleSwapRows(swapResult.data ?? []);
        setLeaveBalanceSummary(null);
        setDayOffMonthlySummary(null);
      }
    } catch (err) {
      setCashAdvanceRows([]);
      setDayOffRows([]);
      setLeaveRows([]);
      setScheduleChangeRows([]);
      setScheduleSwapRows([]);
      setLeaveBalanceSummary(null);
      setDayOffMonthlySummary(null);
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [isDayOffStatusView, isLeaveStatusView]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<EmployeeRequestItem[]>(() => {
    const cashRows: EmployeeRequestItem[] = cashAdvanceRows.map((row) => ({
      id: row.id,
      requestType: "CASH_ADVANCE",
      title: "Cash advance request",
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      status: row.status,
      reason: row.reason,
      managerRemarks: row.managerRemarks,
      amount: row.amount,
      repaymentPerPayroll: row.repaymentPerPayroll,
      dateLabel: `Preferred start ${formatDate(row.preferredStartDate)}`,
      deductionAssignmentId: row.deductionAssignmentId,
      linkedDeductionStatus: row.linkedDeductionStatus,
      linkedDeductionEffectiveFrom: row.linkedDeductionEffectiveFrom,
      linkedDeductionRemainingBalance: row.linkedDeductionRemainingBalance,
    }));

    const leaveItems: EmployeeRequestItem[] = leaveRows.map((row) => {
      const durationDays = countDaysInclusive(row.startDate, row.endDate);
      return {
        id: row.id,
        requestType: "LEAVE",
        title: "Leave request",
        submittedAt: row.submittedAt,
        reviewedAt: row.reviewedAt,
        status: row.status,
        reason: row.reason,
        managerRemarks: row.managerRemarks,
        leaveType: row.leaveType,
        leaveTypeLabel: leaveTypeLabel(row.leaveType),
        durationLabel:
          durationDays == null
            ? "Duration not available"
            : `${durationDays} day${durationDays === 1 ? "" : "s"}`,
        dateLabel: formatDateRange(row.startDate, row.endDate),
        totalDays: row.totalDays,
        paidDaysCount: row.paidDaysCount,
        unpaidDaysCount: row.unpaidDaysCount,
        paidDateList: row.paidDateList,
        unpaidDateList: row.unpaidDateList,
      };
    });

    const dayOffItems: EmployeeRequestItem[] = dayOffRows.map((row) => ({
      id: row.id,
      requestType: "DAY_OFF",
      title: "Day off request",
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      status: row.status,
      reason: row.reason,
      managerRemarks: row.managerRemarks,
      dateLabel: formatDate(row.workDate),
      currentShiftLabel: row.currentShiftLabel,
    }));

    const scheduleChangeItems: EmployeeRequestItem[] = scheduleChangeRows.map(
      (row) => ({
        id: row.id,
        requestType: "SCHEDULE_CHANGE",
        title: "Schedule change request",
        submittedAt: row.submittedAt,
        reviewedAt: row.reviewedAt,
        status: row.status,
        reason: row.reason,
        managerRemarks: row.managerRemarks,
        dateLabel: formatDate(row.workDate),
        currentShiftLabel: row.currentShiftLabel,
        requestedShiftLabel: row.requestedShiftLabel,
      }),
    );

    const swapItems: EmployeeRequestItem[] = scheduleSwapRows.map((row) => {
      const isIncoming = row.isIncomingToViewer;
      return {
        id: row.id,
        requestType: "SCHEDULE_SWAP",
        title: isIncoming
          ? `Swap request from ${row.requesterEmployeeName}`
          : `Schedule swap with ${row.coworkerEmployeeName}`,
        submittedAt: row.submittedAt,
        reviewedAt: row.reviewedAt,
        status: row.status,
        reason: row.reason,
        managerRemarks: row.managerRemarks,
        coworkerRemarks: row.coworkerRemarks,
        dateLabel: formatDate(row.workDate),
        counterpartName: isIncoming
          ? row.requesterEmployeeName
          : row.coworkerEmployeeName,
        counterpartCode: isIncoming
          ? row.requesterEmployeeCode
          : row.coworkerEmployeeCode,
        yourShiftLabel: isIncoming
          ? row.coworkerShiftLabel
          : row.requesterShiftLabel,
        counterpartShiftLabel: isIncoming
          ? row.requesterShiftLabel
          : row.coworkerShiftLabel,
        isIncomingToViewer: isIncoming,
      };
    });

    const mergedRows =
      view === "leave"
        ? leaveItems
        : view === "day-off"
          ? dayOffItems
          : [
              ...cashRows,
              ...dayOffItems,
              ...leaveItems,
              ...scheduleChangeItems,
              ...swapItems,
            ];

    return mergedRows.sort(
      (left, right) =>
        new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime(),
    );
  }, [cashAdvanceRows, dayOffRows, leaveRows, scheduleChangeRows, scheduleSwapRows, view]);

  const pendingCount = useMemo(
    () => rows.filter((row) => row.status === "PENDING_MANAGER").length,
    [rows],
  );
  const approvedCount = useMemo(
    () => rows.filter((row) => row.status === "APPROVED").length,
    [rows],
  );
  const rejectedCount = useMemo(
    () =>
      rows.filter(
        (row) => row.status === "REJECTED" || row.status === "DECLINED",
      ).length,
    [rows],
  );
  const awaitingYourResponseRows = useMemo(
    () =>
      rows.filter(
        (row): row is Extract<EmployeeRequestItem, { requestType: "SCHEDULE_SWAP" }> =>
          row.requestType === "SCHEDULE_SWAP" &&
          row.isIncomingToViewer &&
          row.status === "PENDING_COWORKER",
      ),
    [rows],
  );

  const pageTitle = isLeaveStatusView
    ? "Leave Status"
    : isDayOffStatusView
      ? "Day Off Status"
      : "My Requests";
  const pageDescription =
    isLeaveStatusView
      ? "View your approved leave activity and your yearly paid leave balances. Leave requests are still filed from Requests."
      : isDayOffStatusView
        ? "Track your approved day off activity and the number of approved day offs used this month. Day off requests are still filed from Requests."
        : "Track your submitted requests. Cash advance, day off, leave, schedule change, and schedule swap are currently available request types.";
  const historyTitle = isLeaveStatusView
    ? "Leave History"
    : isDayOffStatusView
      ? "Day Off History"
      : "Request History";
  const historyDescription =
    isLeaveStatusView
      ? "See the current status of your leave requests, including how many approved leave days were marked as paid or unpaid."
      : isDayOffStatusView
        ? "See your day off request history and how many approved day offs you have used this month."
        : "Approved cash advance requests create the linked payroll deduction automatically. Day off, leave, schedule change, and schedule swap requests are tracked here for review history.";

  const handleSwapResponse = async (
    row: Extract<EmployeeRequestItem, { requestType: "SCHEDULE_SWAP" }>,
    decision: "ACCEPTED" | "DECLINED",
  ) => {
    try {
      setRespondingSwapKey(row.id);
      setError(null);

      const result = await respondToScheduleSwapRequest({
        id: row.id,
        decision,
        coworkerRemarks: swapResponseNotes[row.id],
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to respond to schedule swap");
      }

      await load();
      toast.success(
        decision === "ACCEPTED"
          ? "Schedule swap accepted successfully."
          : "Schedule swap declined successfully.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to respond to schedule swap";
      setError(message);
      toast.error("Failed to respond to schedule swap.", {
        description: message,
      });
    } finally {
      setRespondingSwapKey(null);
    }
  };

  const detailDescription = detailRow
      ? detailRow.requestType === "CASH_ADVANCE"
        ? "Cash advance request details and linked deduction status."
        : detailRow.requestType === "DAY_OFF"
          ? "Day off request details, including the current schedule that will be cleared after approval."
        : detailRow.requestType === "LEAVE"
          ? "Leave request details, schedule, and paid or unpaid breakdown."
        : detailRow.requestType === "SCHEDULE_CHANGE"
          ? "Schedule change request details, including the current schedule and the requested new shift."
          : "Schedule swap request details, counterpart, and current shift snapshots."
    : "";

  const isInitialPageLoading =
    loading &&
    !error &&
    cashAdvanceRows.length === 0 &&
    dayOffRows.length === 0 &&
    leaveRows.length === 0 &&
    scheduleChangeRows.length === 0 &&
    scheduleSwapRows.length === 0 &&
    !leaveBalanceSummary &&
    !dayOffMonthlySummary;

  if (isInitialPageLoading) {
    return (
      <ModuleLoadingState
        title="Requests"
        description="Loading your requests, balances, and approval history."
      />
    );
  }

  return (
    <div className="relative min-h-[70vh] space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{pageDescription}</p>
        </div>
        {isLeaveStatusView ? (
          <Button asChild type="button" variant="outline">
            <Link href="/employee/requests">Open Requests</Link>
          </Button>
        ) : isDayOffStatusView ? (
          <Button asChild type="button" variant="outline">
            <Link href="/employee/requests">Open Requests</Link>
          </Button>
        ) : (
          <Button asChild type="button">
            <Link href="/employee/requests/add">New Request</Link>
          </Button>
        )}
      </div>

      {isLeaveStatusView ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paid Leave Left
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {leaveBalanceSummary
                  ? `${leaveBalanceSummary.paidLeaveRemaining} / ${leaveBalanceSummary.paidLeaveAllowance}`
                  : "0 / 10"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {leaveBalanceSummary
                  ? `${leaveBalanceSummary.paidLeaveUsed} used in ${leaveBalanceSummary.year}`
                  : "Resets every year"}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paid Sick Left
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {leaveBalanceSummary
                  ? `${leaveBalanceSummary.paidSickLeaveRemaining} / ${leaveBalanceSummary.paidSickLeaveAllowance}`
                  : "0 / 10"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {leaveBalanceSummary
                  ? `${leaveBalanceSummary.paidSickLeaveUsed} used in ${leaveBalanceSummary.year}`
                  : "Resets every year"}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Review
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
                Rejected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{rejectedCount}</p>
            </CardContent>
          </Card>
        </div>
      ) : isDayOffStatusView ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Day Off This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {dayOffMonthlySummary?.approvedThisMonth ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dayOffMonthlySummary
                  ? `${dayOffMonthlySummary.monthLabel} usage`
                  : "Resets every month"}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Review
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
                Rejected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{rejectedCount}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Review
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
                Rejected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{rejectedCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!isLeaveStatusView && awaitingYourResponseRows.length > 0 ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Awaiting Your Response</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review incoming schedule swap requests before they move to manager
              approval.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {awaitingYourResponseRows.map((row) => (
              <div
                key={`incoming-${row.id}`}
                className="rounded-2xl border border-border/70 bg-background p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{row.title}</h3>
                      <Badge variant="secondary">Schedule Swap</Badge>
                      <Badge variant="outline" className={requestStatusClass(row.status)}>
                        {requestStatusLabel(row.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Work date {row.dateLabel}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.counterpartCode} · {row.counterpartName}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[28rem]">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Your Current Schedule
                      </p>
                      <p className="mt-2 font-medium">{row.yourShiftLabel}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {row.counterpartName}&apos;s Schedule
                      </p>
                      <p className="mt-2 font-medium">{row.counterpartShiftLabel}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Response Note
                  </p>
                  <textarea
                    value={swapResponseNotes[row.id] ?? ""}
                    onChange={(event) =>
                      setSwapResponseNotes((current) => ({
                        ...current,
                        [row.id]: event.target.value,
                      }))
                    }
                    placeholder="Optional note if you accept. Required if you decline."
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setDetailRow(row)}
                    >
                      View Details
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={respondingSwapKey === row.id}
                      onClick={() => void handleSwapResponse(row, "DECLINED")}
                    >
                      Decline Swap
                    </Button>
                    <Button
                      type="button"
                      disabled={respondingSwapKey === row.id}
                      onClick={() => void handleSwapResponse(row, "ACCEPTED")}
                    >
                      Accept Swap
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{historyTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">{historyDescription}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {view === "leave"
                ? "No leave requests yet. Submit one when you need time away."
                : view === "day-off"
                  ? "No day off requests yet. Submit one from Requests when you need a scheduled day off."
                  : "No requests yet. Cash advance, day off, leave, schedule change, and schedule swap are currently available to submit."}
            </p>
          ) : null}

          <div className="space-y-4">
            {rows.map((row) => (
              <div
                key={`${row.requestType}-${row.id}`}
                className="rounded-2xl border border-border/70 bg-background p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{row.title}</h3>
                      <Badge variant="secondary">
                        {requestTypeLabel(row.requestType)}
                      </Badge>
                      <Badge variant="outline" className={requestStatusClass(row.status)}>
                        {requestStatusLabel(row.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Submitted {formatDate(row.submittedAt)}
                    </p>
                    <p className="text-sm text-muted-foreground">{row.dateLabel}</p>
                  </div>

                  {row.requestType === "CASH_ADVANCE" ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[20rem]">
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Requested Amount
                        </p>
                        <p className="mt-2 font-medium">{formatMoney(row.amount)}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Per Payroll
                        </p>
                        <p className="mt-2 font-medium">
                          {formatMoney(row.repaymentPerPayroll)}
                        </p>
                      </div>
                    </div>
                  ) : row.requestType === "LEAVE" ? (
                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[26rem]">
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Leave Type
                        </p>
                        <p className="mt-2 font-medium">{row.leaveTypeLabel}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Duration
                        </p>
                        <p className="mt-2 font-medium">{row.durationLabel}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Leave Pay
                        </p>
                        <p className="mt-2 font-medium">
                          {row.status === "APPROVED"
                            ? `${row.paidDaysCount} paid • ${Math.max(
                                0,
                                row.totalDays - row.paidDaysCount,
                              )} unpaid`
                            : "Manager decides on review"}
                        </p>
                      </div>
                    </div>
                  ) : row.requestType === "DAY_OFF" ? (
                    <div className="grid gap-3 lg:min-w-[22rem]">
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Current Schedule
                        </p>
                        <p className="mt-2 font-medium">{row.currentShiftLabel}</p>
                      </div>
                    </div>
                  ) : row.requestType === "SCHEDULE_CHANGE" ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[28rem]">
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Current Schedule
                        </p>
                        <p className="mt-2 font-medium">{row.currentShiftLabel}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Requested Schedule
                        </p>
                        <p className="mt-2 font-medium">{row.requestedShiftLabel}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[28rem]">
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Your Schedule
                        </p>
                        <p className="mt-2 font-medium">{row.yourShiftLabel}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {row.counterpartName}&apos;s Schedule
                        </p>
                        <p className="mt-2 font-medium">{row.counterpartShiftLabel}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className={
                    row.requestType === "CASH_ADVANCE"
                      ? "mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
                      : row.requestType === "DAY_OFF"
                        ? "mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
                        : row.requestType === "SCHEDULE_CHANGE"
                        ? "mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
                      : row.requestType === "SCHEDULE_SWAP"
                        ? "mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
                        : "mt-4"
                  }
                >
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Request Reason
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.reason || "No reason provided."}
                    </p>
                    {row.managerRemarks ? (
                      <>
                        <p className="pt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Manager Remarks
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {row.managerRemarks}
                        </p>
                      </>
                    ) : null}
                    {row.requestType === "SCHEDULE_SWAP" && row.coworkerRemarks ? (
                      <>
                        <p className="pt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Coworker Note
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {row.coworkerRemarks}
                        </p>
                      </>
                    ) : null}
                  </div>

                  {row.requestType === "CASH_ADVANCE" ? (
                    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Linked Deduction
                      </p>
                      <p className="font-medium">
                        {linkedDeductionStatusLabel(row.linkedDeductionStatus)}
                      </p>
                      {row.deductionAssignmentId ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            Effective {formatDate(row.linkedDeductionEffectiveFrom)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Remaining{" "}
                            {formatMoney(row.linkedDeductionRemainingBalance ?? 0)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          A deduction will appear here after approval.
                        </p>
                      )}
                    </div>
                  ) : row.requestType === "DAY_OFF" ? (
                    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Result After Approval
                      </p>
                      <p className="font-medium">Day off</p>
                      <p className="text-sm text-muted-foreground">
                        The current schedule will be cleared and treated as a rest day.
                      </p>
                    </div>
                  ) : row.requestType === "SCHEDULE_CHANGE" ? (
                    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Requested Change
                      </p>
                      <p className="font-medium">{row.requestedShiftLabel}</p>
                      <p className="text-sm text-muted-foreground">
                        Replacing {row.currentShiftLabel}
                      </p>
                    </div>
                  ) : row.requestType === "SCHEDULE_SWAP" ? (
                    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Swap Counterpart
                      </p>
                      <p className="font-medium">{row.counterpartName}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.counterpartCode}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {row.isIncomingToViewer
                          ? "You were asked to swap with this coworker."
                          : "This coworker was asked to take your shift in exchange for theirs."}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDetailRow(row)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={detailRow !== null}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {detailRow ? (
            <>
              <DialogHeader>
                <DialogTitle>{detailRow.title}</DialogTitle>
                <DialogDescription>{detailDescription}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {requestTypeLabel(detailRow.requestType)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={requestStatusClass(detailRow.status)}
                  >
                    {requestStatusLabel(detailRow.status)}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Submitted
                    </p>
                    <p className="mt-2 font-medium">
                      {formatDate(detailRow.submittedAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Reviewed
                    </p>
                    <p className="mt-2 font-medium">
                      {detailRow.reviewedAt
                        ? formatDate(detailRow.reviewedAt)
                        : "Not yet reviewed"}
                    </p>
                  </div>
                </div>

                {detailRow.requestType === "CASH_ADVANCE" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Requested Amount
                      </p>
                      <p className="mt-2 font-medium">
                        {formatMoney(detailRow.amount)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Repayment Per Payroll
                      </p>
                      <p className="mt-2 font-medium">
                        {formatMoney(detailRow.repaymentPerPayroll)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Preferred Start
                      </p>
                      <p className="mt-2 font-medium">{detailRow.dateLabel}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Linked Deduction
                      </p>
                      <p className="mt-2 font-medium">
                        {linkedDeductionStatusLabel(detailRow.linkedDeductionStatus)}
                      </p>
                      {detailRow.deductionAssignmentId ? (
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          <p>
                            Effective{" "}
                            {formatDate(detailRow.linkedDeductionEffectiveFrom)}
                          </p>
                          <p>
                            Remaining{" "}
                            {formatMoney(
                              detailRow.linkedDeductionRemainingBalance ?? 0,
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          A deduction will appear here after approval.
                        </p>
                      )}
                    </div>
                  </div>
                ) : detailRow.requestType === "LEAVE" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Leave Type
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.leaveTypeLabel}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Duration
                      </p>
                      <p className="mt-2 font-medium">{detailRow.durationLabel}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Leave Dates
                      </p>
                      <p className="mt-2 font-medium">{detailRow.dateLabel}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Paid Days
                      </p>
                      <p className="mt-2 font-medium">{detailRow.paidDaysCount}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Unpaid Days
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.unpaidDaysCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Paid Dates
                      </p>
                      {detailRow.paidDateList.length > 0 ? (
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {detailRow.paidDateList.map((date) => (
                            <p key={`paid-${date}`}>{formatDate(date)}</p>
                          ))}
                        </div>
                      ) : detailRow.status === "APPROVED" ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No paid leave dates were assigned.
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Paid dates will be decided during manager review.
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Unpaid Dates
                      </p>
                      {detailRow.unpaidDateList.length > 0 ? (
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {detailRow.unpaidDateList.map((date) => (
                            <p key={`unpaid-${date}`}>{formatDate(date)}</p>
                          ))}
                        </div>
                      ) : detailRow.status === "APPROVED" ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No unpaid leave dates were assigned.
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Unpaid dates will be decided during manager review.
                        </p>
                      )}
                    </div>
                  </div>
                ) : detailRow.requestType === "DAY_OFF" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Work Date
                      </p>
                      <p className="mt-2 font-medium">{detailRow.dateLabel}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Current Schedule
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.currentShiftLabel}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Result After Approval
                      </p>
                      <p className="mt-2 font-medium">Day off</p>
                    </div>
                  </div>
                ) : detailRow.requestType === "SCHEDULE_CHANGE" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Work Date
                      </p>
                      <p className="mt-2 font-medium">{detailRow.dateLabel}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Current Schedule
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.currentShiftLabel}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Requested Schedule
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.requestedShiftLabel}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Work Date
                      </p>
                      <p className="mt-2 font-medium">{detailRow.dateLabel}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Counterpart
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.counterpartName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {detailRow.counterpartCode}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Request Direction
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.isIncomingToViewer
                          ? "Incoming request for your response"
                          : "Submitted by you"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Your Schedule
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.yourShiftLabel}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Counterpart Schedule
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.counterpartShiftLabel}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Request Reason
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {detailRow.reason || "No reason provided."}
                  </p>
                </div>

                {detailRow.managerRemarks ? (
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Manager Remarks
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {detailRow.managerRemarks}
                    </p>
                  </div>
                ) : null}

                {detailRow.requestType === "SCHEDULE_SWAP" &&
                detailRow.coworkerRemarks ? (
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Coworker Note
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {detailRow.coworkerRemarks}
                    </p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
