"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listCashAdvanceRequests,
  listDayOffRequests,
  listLeaveRequests,
  listScheduleChangeRequests,
  listScheduleSwapRequests,
  reviewCashAdvanceRequest,
  reviewDayOffRequest,
  reviewLeaveRequest,
  reviewScheduleChangeRequest,
  reviewScheduleSwapRequest,
  type CashAdvanceRequestRow,
  type DayOffRequestRow,
  type LeaveRequestRow,
  type ScheduleChangeRequestRow,
  type ScheduleSwapRequestRow,
} from "@/actions/requests/requests-action";
import {
  countDaysInclusive,
  enumerateDateKeysInRange,
  formatDate,
  formatDateKey,
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
import {
  InlineLoadingState,
  ModuleLoadingState,
} from "@/components/loading/loading-states";
import { useToast } from "@/components/ui/toast-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ManagerRequestItem =
  | {
      id: string;
      requestType: "CASH_ADVANCE";
      employeeName: string;
      employeeCode: string;
      submittedAt: string;
      reviewedAt?: string | null;
      status: CashAdvanceRequestRow["status"];
      reason?: string | null;
      managerRemarks?: string | null;
      amount: number;
      repaymentPerPayroll: number;
      startDateLabel: string;
      linkedDeductionStatus?: CashAdvanceRequestRow["linkedDeductionStatus"];
      linkedDeductionRemainingBalance?: number | null;
    }
  | {
      id: string;
      requestType: "LEAVE";
      employeeName: string;
      employeeCode: string;
      submittedAt: string;
      reviewedAt?: string | null;
      status: LeaveRequestRow["status"];
      reason?: string | null;
      managerRemarks?: string | null;
      leaveType: LeaveRequestRow["leaveType"];
      leaveTypeLabel: string;
      durationLabel: string;
      scheduleLabel: string;
      startDate: string;
      endDate: string;
      totalDays: number;
      paidDaysCount: number;
      unpaidDaysCount: number;
      paidDateList: string[];
      unpaidDateList: string[];
    }
  | {
      id: string;
      requestType: "DAY_OFF";
      employeeName: string;
      employeeCode: string;
      submittedAt: string;
      reviewedAt?: string | null;
      status: DayOffRequestRow["status"];
      reason?: string | null;
      managerRemarks?: string | null;
      workDateLabel: string;
      currentShiftLabel: string;
    }
  | {
      id: string;
      requestType: "SCHEDULE_CHANGE";
      employeeName: string;
      employeeCode: string;
      submittedAt: string;
      reviewedAt?: string | null;
      status: ScheduleChangeRequestRow["status"];
      reason?: string | null;
      managerRemarks?: string | null;
      workDateLabel: string;
      currentShiftLabel: string;
      requestedShiftLabel: string;
    }
  | {
      id: string;
      requestType: "SCHEDULE_SWAP";
      requesterEmployeeName: string;
      requesterEmployeeCode: string;
      coworkerEmployeeName: string;
      coworkerEmployeeCode: string;
      submittedAt: string;
      reviewedAt?: string | null;
      status: ScheduleSwapRequestRow["status"];
      reason?: string | null;
      coworkerRemarks?: string | null;
      managerRemarks?: string | null;
      workDateLabel: string;
      requesterShiftLabel: string;
      coworkerShiftLabel: string;
    };

export default function ManagerRequestsPage() {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const [managerNotes, setManagerNotes] = useState<Record<string, string>>({});
  const [leavePaidDatesByKey, setLeavePaidDatesByKey] = useState<
    Record<string, string[]>
  >({});
  const [detailRow, setDetailRow] = useState<ManagerRequestItem | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [cashResult, dayOffResult, leaveResult, changeResult, swapResult] =
        await Promise.all([
        listCashAdvanceRequests(),
        listDayOffRequests(),
        listLeaveRequests(),
        listScheduleChangeRequests(),
        listScheduleSwapRequests(),
        ]);

      if (!cashResult.success) {
        throw new Error(cashResult.error || "Failed to load cash advance requests");
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
    } catch (err) {
      setCashAdvanceRows([]);
      setDayOffRows([]);
      setLeaveRows([]);
      setScheduleChangeRows([]);
      setScheduleSwapRows([]);
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo<ManagerRequestItem[]>(() => {
    const cashRows: ManagerRequestItem[] = cashAdvanceRows.map((row) => ({
      id: row.id,
      requestType: "CASH_ADVANCE",
      employeeName: row.employeeName,
      employeeCode: row.employeeCode,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      status: row.status,
      reason: row.reason,
      managerRemarks: row.managerRemarks,
      amount: row.amount,
      repaymentPerPayroll: row.repaymentPerPayroll,
      startDateLabel: formatDate(row.preferredStartDate),
      linkedDeductionStatus: row.linkedDeductionStatus,
      linkedDeductionRemainingBalance: row.linkedDeductionRemainingBalance,
    }));

    const leaveItems: ManagerRequestItem[] = leaveRows.map((row) => {
      const durationDays = countDaysInclusive(row.startDate, row.endDate);
      return {
        id: row.id,
        requestType: "LEAVE",
        employeeName: row.employeeName,
        employeeCode: row.employeeCode,
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
        scheduleLabel: formatDateRange(row.startDate, row.endDate),
        startDate: row.startDate,
        endDate: row.endDate,
        totalDays: row.totalDays,
        paidDaysCount: row.paidDaysCount,
        unpaidDaysCount: row.unpaidDaysCount,
        paidDateList: row.paidDateList,
        unpaidDateList: row.unpaidDateList,
      };
    });

    const dayOffItems: ManagerRequestItem[] = dayOffRows.map((row) => ({
      id: row.id,
      requestType: "DAY_OFF",
      employeeName: row.employeeName,
      employeeCode: row.employeeCode,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      status: row.status,
      reason: row.reason,
      managerRemarks: row.managerRemarks,
      workDateLabel: formatDate(row.workDate),
      currentShiftLabel: row.currentShiftLabel,
    }));

    const scheduleChangeItems: ManagerRequestItem[] = scheduleChangeRows.map(
      (row) => ({
        id: row.id,
        requestType: "SCHEDULE_CHANGE",
        employeeName: row.employeeName,
        employeeCode: row.employeeCode,
        submittedAt: row.submittedAt,
        reviewedAt: row.reviewedAt,
        status: row.status,
        reason: row.reason,
        managerRemarks: row.managerRemarks,
        workDateLabel: formatDate(row.workDate),
        currentShiftLabel: row.currentShiftLabel,
        requestedShiftLabel: row.requestedShiftLabel,
      }),
    );

    const swapItems: ManagerRequestItem[] = scheduleSwapRows.map((row) => ({
      id: row.id,
      requestType: "SCHEDULE_SWAP",
      requesterEmployeeName: row.requesterEmployeeName,
      requesterEmployeeCode: row.requesterEmployeeCode,
      coworkerEmployeeName: row.coworkerEmployeeName,
      coworkerEmployeeCode: row.coworkerEmployeeCode,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      status: row.status,
      reason: row.reason,
      coworkerRemarks: row.coworkerRemarks,
      managerRemarks: row.managerRemarks,
      workDateLabel: formatDate(row.workDate),
      requesterShiftLabel: row.requesterShiftLabel,
      coworkerShiftLabel: row.coworkerShiftLabel,
    }));

    return [
      ...cashRows,
      ...dayOffItems,
      ...leaveItems,
      ...scheduleChangeItems,
      ...swapItems,
    ].sort(
      (left, right) =>
        new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime(),
    );
  }, [cashAdvanceRows, dayOffRows, leaveRows, scheduleChangeRows, scheduleSwapRows]);

  const pendingRows = useMemo(
    () => rows.filter((row) => row.status === "PENDING_MANAGER"),
    [rows],
  );
  const approvedRows = useMemo(
    () => rows.filter((row) => row.status === "APPROVED"),
    [rows],
  );
  const rejectedRows = useMemo(
    () =>
      rows.filter(
        (row) => row.status === "REJECTED" || row.status === "DECLINED",
      ),
    [rows],
  );
  const waitingOnCoworkerRows = useMemo(
    () =>
      rows.filter(
        (row): row is Extract<ManagerRequestItem, { requestType: "SCHEDULE_SWAP" }> =>
          row.requestType === "SCHEDULE_SWAP" &&
          row.status === "PENDING_COWORKER",
      ),
    [rows],
  );

  if (
    loading &&
    !error &&
    cashAdvanceRows.length === 0 &&
    dayOffRows.length === 0 &&
    leaveRows.length === 0 &&
    scheduleChangeRows.length === 0 &&
    scheduleSwapRows.length === 0
  ) {
    return (
      <ModuleLoadingState
        title="Requests"
        description="Loading pending requests, review actions, and request history."
      />
    );
  }

  const getDefaultPaidDateKeys = (row: Extract<ManagerRequestItem, { requestType: "LEAVE" }>) =>
    row.leaveType === "UNPAID"
      ? []
      : enumerateDateKeysInRange(row.startDate, row.endDate);

  const getSelectedPaidDateKeys = (
    row: Extract<ManagerRequestItem, { requestType: "LEAVE" }>,
  ) => {
    const key = `${row.requestType}-${row.id}`;
    return leavePaidDatesByKey[key] ?? getDefaultPaidDateKeys(row);
  };

  const togglePaidDate = (
    row: Extract<ManagerRequestItem, { requestType: "LEAVE" }>,
    dateKey: string,
    nextIsPaid: boolean,
  ) => {
    const key = `${row.requestType}-${row.id}`;
    const currentSelection = getSelectedPaidDateKeys(row);
    const nextSelection = nextIsPaid
      ? Array.from(new Set([...currentSelection, dateKey])).sort()
      : currentSelection.filter((value) => value !== dateKey);

    setLeavePaidDatesByKey((current) => ({
      ...current,
      [key]: nextSelection,
    }));
  };

  const handleReview = async (
    row: ManagerRequestItem,
    decision: "APPROVED" | "REJECTED",
  ) => {
    const key = `${row.requestType}-${row.id}`;

    try {
      setReviewingKey(key);
      setError(null);

      const payload = {
        id: row.id,
        decision,
        managerRemarks: managerNotes[key],
        paidDates:
          row.requestType === "LEAVE" && decision === "APPROVED"
            ? getSelectedPaidDateKeys(row)
            : undefined,
      };

      const result =
        row.requestType === "CASH_ADVANCE"
          ? await reviewCashAdvanceRequest(payload)
          : row.requestType === "DAY_OFF"
            ? await reviewDayOffRequest(payload)
          : row.requestType === "LEAVE"
            ? await reviewLeaveRequest(payload)
            : row.requestType === "SCHEDULE_CHANGE"
              ? await reviewScheduleChangeRequest(payload)
            : await reviewScheduleSwapRequest(payload);

      if (!result.success) {
        throw new Error(result.error || "Failed to review request");
      }

      await load();
      toast.success(
        decision === "APPROVED"
          ? "Request approved successfully."
          : "Request rejected successfully.",
        {
          description: `${requestTypeLabel(row.requestType)} request for ${"employeeName" in row ? row.employeeName : row.requesterEmployeeName} was ${decision === "APPROVED" ? "approved" : "rejected"}.`,
        },
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to review request";
      setError(message);
      toast.error("Failed to review request.", {
        description: message,
      });
    } finally {
      setReviewingKey(null);
    }
  };

  const detailDescription = detailRow
    ? detailRow.requestType === "CASH_ADVANCE"
      ? "Request details for the cash advance and its payroll deduction outcome."
      : detailRow.requestType === "DAY_OFF"
        ? "Day off request details, including the employee's current schedule that will be cleared after approval."
      : detailRow.requestType === "LEAVE"
        ? "Leave request details, requested dates, and paid or unpaid allocation."
        : detailRow.requestType === "SCHEDULE_CHANGE"
          ? "Schedule change request details, including the employee's current schedule and the requested replacement shift."
          : "Schedule swap details, both employees involved, and the shift exchange preview."
    : "";

  const getDetailLeaveDateLists = (
    row: Extract<ManagerRequestItem, { requestType: "LEAVE" }>,
  ) => {
    if (row.status === "PENDING_MANAGER") {
      const paidDateSet = new Set(getSelectedPaidDateKeys(row));
      const allDateKeys = enumerateDateKeysInRange(row.startDate, row.endDate);

      return {
        paidDates: allDateKeys.filter((dateKey) => paidDateSet.has(dateKey)),
        unpaidDates: allDateKeys.filter((dateKey) => !paidDateSet.has(dateKey)),
      };
    }

    return {
      paidDates: row.paidDateList,
      unpaidDates: row.unpaidDateList,
    };
  };

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">Request Review Queue</h1>
        <p className="text-sm text-muted-foreground">
          Review employee requests. Cash advance, day off, leave, schedule
          change, and schedule swap are currently the active request types.
          Cash advance approval creates the linked deduction automatically,
          while day off, schedule change, and schedule swap approval apply day
          overrides.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{pendingRows.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{approvedRows.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{rejectedRows.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Awaiting Coworker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{waitingOnCoworkerRows.length}</p>
          </CardContent>
        </Card>
      </div>

      {waitingOnCoworkerRows.length > 0 ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Awaiting Coworker Response</CardTitle>
            <p className="text-sm text-muted-foreground">
              These schedule swap requests are still waiting for the selected
              coworker to accept before they become actionable for manager
              review.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {waitingOnCoworkerRows.map((row) => (
              <div
                key={`waiting-${row.id}`}
                className="rounded-2xl border border-border/70 bg-background p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {row.requesterEmployeeName} ↔ {row.coworkerEmployeeName}
                      </h3>
                      <Badge variant="secondary">Schedule Swap</Badge>
                      <Badge variant="outline" className={requestStatusClass(row.status)}>
                        {requestStatusLabel(row.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Work date {row.workDateLabel}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[30rem]">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {row.requesterEmployeeName}
                      </p>
                      <p className="mt-2 font-medium">{row.requesterShiftLabel}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {row.coworkerEmployeeName}
                      </p>
                      <p className="mt-2 font-medium">{row.coworkerShiftLabel}</p>
                    </div>
                  </div>
                </div>

                {row.reason ? (
                  <p className="mt-4 text-sm text-muted-foreground">{row.reason}</p>
                ) : null}

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
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Pending Review</CardTitle>
            <p className="text-sm text-muted-foreground">
              Approve requests here. Cash advance approval creates the linked
              deduction automatically, day off approval clears the day to a rest
              day, schedule change approval applies the requested override, and
              schedule swap approval applies the override for both employees on
              that date.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {loading ? (
            <InlineLoadingState label="Loading requests" lines={3} />
          ) : null}
          {!loading && pendingRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No requests waiting for review.
            </p>
          ) : null}

          {pendingRows.map((row) => {
            const key = `${row.requestType}-${row.id}`;
            return (
              <div
                key={key}
                className="rounded-2xl border border-border/70 bg-background p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {row.requestType === "SCHEDULE_SWAP"
                          ? `${row.requesterEmployeeName} ↔ ${row.coworkerEmployeeName}`
                          : row.employeeName}
                      </h3>
                      <Badge variant="secondary">
                        {requestTypeLabel(row.requestType)}
                      </Badge>
                      <Badge variant="outline" className={requestStatusClass(row.status)}>
                        {requestStatusLabel(row.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {row.requestType === "SCHEDULE_SWAP"
                        ? `${row.requesterEmployeeCode} · ${row.coworkerEmployeeCode}`
                        : row.employeeCode}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Submitted {formatDate(row.submittedAt)}
                    </p>
                  </div>

                  {row.requestType === "CASH_ADVANCE" ? (
                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[30rem]">
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Amount
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
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Start Date
                        </p>
                        <p className="mt-2 font-medium">{row.startDateLabel}</p>
                      </div>
                    </div>
                  ) : row.requestType === "LEAVE" ? (
                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[30rem]">
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Leave Type
                        </p>
                        <p className="mt-2 font-medium">{row.leaveTypeLabel}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Leave Dates
                        </p>
                        <p className="mt-2 font-medium">{row.scheduleLabel}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Duration
                        </p>
                        <p className="mt-2 font-medium">{row.durationLabel}</p>
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
                    <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[30rem]">
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
                        <p className="mt-2 font-medium">
                          {row.requestedShiftLabel}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[30rem]">
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {row.requesterEmployeeName}
                        </p>
                        <p className="mt-2 font-medium">{row.requesterShiftLabel}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {row.coworkerEmployeeName}
                        </p>
                        <p className="mt-2 font-medium">{row.coworkerShiftLabel}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-4">
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Request Reason
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.reason || "No reason provided."}
                    </p>
                  </div>

                  {row.requestType === "LEAVE" ? (
                    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Paid Leave Plan
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Choose which requested dates should count as paid leave.
                          </p>
                        </div>
                        <p className="text-sm font-medium">
                          {getSelectedPaidDateKeys(row).length} paid /{" "}
                          {Math.max(
                            0,
                            row.totalDays - getSelectedPaidDateKeys(row).length,
                          )}{" "}
                          unpaid
                        </p>
                      </div>

                      <div className="space-y-2">
                        {enumerateDateKeysInRange(row.startDate, row.endDate).map(
                          (dateKey) => {
                            const isPaid = getSelectedPaidDateKeys(row).includes(
                              dateKey,
                            );

                            return (
                              <div
                                key={dateKey}
                                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <p className="text-sm font-medium">
                                  {formatDateKey(dateKey)}
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isPaid ? "default" : "outline"}
                                    onClick={() => togglePaidDate(row, dateKey, true)}
                                    disabled={reviewingKey === key}
                                  >
                                    Paid
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={!isPaid ? "secondary" : "outline"}
                                    onClick={() => togglePaidDate(row, dateKey, false)}
                                    disabled={reviewingKey === key}
                                  >
                                    Unpaid
                                  </Button>
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  ) : row.requestType === "DAY_OFF" ? (
                    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Result After Approval
                      </p>
                      <div className="rounded-xl border border-border/60 bg-background p-3">
                        <p className="text-sm text-muted-foreground">Current schedule</p>
                        <p className="mt-2 font-medium">{row.currentShiftLabel}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background p-3">
                        <p className="text-sm text-muted-foreground">Approved result</p>
                        <p className="mt-2 font-medium">Day off</p>
                      </div>
                    </div>
                  ) : row.requestType === "SCHEDULE_SWAP" ? (
                    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Swap Preview
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-border/60 bg-background p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {row.requesterEmployeeName}
                          </p>
                          <p className="mt-2 font-medium">{row.requesterShiftLabel}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {row.coworkerEmployeeName}
                          </p>
                          <p className="mt-2 font-medium">{row.coworkerShiftLabel}</p>
                        </div>
                      </div>
                      {row.coworkerRemarks ? (
                        <p className="text-sm text-muted-foreground">
                          Coworker note: {row.coworkerRemarks}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Manager Remarks
                    </p>
                    <Input
                      value={managerNotes[key] ?? ""}
                      onChange={(event) =>
                        setManagerNotes((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      placeholder="Optional approval or rejection note"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDetailRow(row)}
                    disabled={reviewingKey === key}
                  >
                    View Details
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleReview(row, "REJECTED")}
                    disabled={reviewingKey === key}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleReview(row, "APPROVED")}
                    disabled={reviewingKey === key}
                  >
                    {row.requestType === "CASH_ADVANCE"
                      ? "Approve & Create Deduction"
                      : row.requestType === "DAY_OFF"
                        ? "Approve & Mark Day Off"
                      : row.requestType === "SCHEDULE_CHANGE"
                        ? "Approve & Apply Change"
                      : row.requestType === "SCHEDULE_SWAP"
                        ? "Approve & Apply Swap"
                      : "Approve Request"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Recent Decisions</CardTitle>
        </CardHeader>
        <CardContent>
          {!loading && approvedRows.length === 0 && rejectedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reviewed requests yet.
            </p>
          ) : null}
          <div className="space-y-4">
            {[...approvedRows, ...rejectedRows]
              .sort(
                (a, b) =>
                  new Date(b.reviewedAt ?? b.submittedAt).getTime() -
                  new Date(a.reviewedAt ?? a.submittedAt).getTime(),
              )
              .slice(0, 10)
              .map((row) => (
                <div
                  key={`${row.requestType}-${row.id}`}
                  className="rounded-2xl border border-border/70 bg-background p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">
                          {row.requestType === "SCHEDULE_SWAP"
                            ? `${row.requesterEmployeeName} ↔ ${row.coworkerEmployeeName}`
                            : row.employeeName}
                        </h3>
                        <Badge variant="secondary">
                          {requestTypeLabel(row.requestType)}
                        </Badge>
                        <Badge variant="outline" className={requestStatusClass(row.status)}>
                          {requestStatusLabel(row.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Reviewed {formatDate(row.reviewedAt)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {row.requestType === "CASH_ADVANCE"
                          ? `Start date ${row.startDateLabel}`
                        : row.requestType === "LEAVE"
                            ? row.scheduleLabel
                            : row.requestType === "DAY_OFF"
                              ? `Work date ${row.workDateLabel}`
                            : row.requestType === "SCHEDULE_CHANGE"
                              ? `Work date ${row.workDateLabel}`
                            : `Work date ${row.workDateLabel}`}
                      </p>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4 lg:min-w-[18rem]">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Summary
                      </p>
                      {row.requestType === "CASH_ADVANCE" ? (
                        <>
                          <p className="font-medium">
                            {linkedDeductionStatusLabel(row.linkedDeductionStatus)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Remaining{" "}
                            {formatMoney(row.linkedDeductionRemainingBalance ?? 0)}
                          </p>
                        </>
                      ) : row.requestType === "LEAVE" ? (
                        <>
                          <p className="font-medium">{row.leaveTypeLabel}</p>
                          <p className="text-sm text-muted-foreground">
                            {row.durationLabel}
                          </p>
                          {row.status === "APPROVED" ? (
                            <p className="text-sm text-muted-foreground">
                              {row.paidDaysCount} paid •{" "}
                              {Math.max(
                                0,
                                row.totalDays - row.paidDaysCount,
                              )}{" "}
                              unpaid
                            </p>
                          ) : null}
                        </>
                      ) : row.requestType === "DAY_OFF" ? (
                        <>
                          <p className="font-medium">Day off</p>
                          <p className="text-sm text-muted-foreground">
                            Current schedule: {row.currentShiftLabel}
                          </p>
                        </>
                      ) : row.requestType === "SCHEDULE_CHANGE" ? (
                        <>
                          <p className="font-medium">{row.requestedShiftLabel}</p>
                          <p className="text-sm text-muted-foreground">
                            Replacing {row.currentShiftLabel}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium">{row.requesterEmployeeName}</p>
                          <p className="text-sm text-muted-foreground">
                            {row.requesterShiftLabel}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {row.coworkerEmployeeName}: {row.coworkerShiftLabel}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {row.managerRemarks || (row.requestType === "SCHEDULE_SWAP" && row.coworkerRemarks) ? (
                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                      {row.managerRemarks ? <p>{row.managerRemarks}</p> : null}
                      {row.requestType === "SCHEDULE_SWAP" && row.coworkerRemarks ? (
                        <p>Coworker note: {row.coworkerRemarks}</p>
                      ) : null}
                    </div>
                  ) : null}
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
                <DialogTitle>
                  {detailRow.requestType === "SCHEDULE_SWAP"
                    ? `${detailRow.requesterEmployeeName} ↔ ${detailRow.coworkerEmployeeName}`
                    : detailRow.employeeName}
                </DialogTitle>
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
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Employee
                      </p>
                      <p className="mt-2 font-medium">{detailRow.employeeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {detailRow.employeeCode}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Amount
                      </p>
                      <p className="mt-2 font-medium">
                        {formatMoney(detailRow.amount)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Per Payroll
                      </p>
                      <p className="mt-2 font-medium">
                        {formatMoney(detailRow.repaymentPerPayroll)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Preferred Start
                      </p>
                      <p className="mt-2 font-medium">{detailRow.startDateLabel}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Linked Deduction
                      </p>
                      <p className="mt-2 font-medium">
                        {linkedDeductionStatusLabel(detailRow.linkedDeductionStatus)}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Remaining{" "}
                        {formatMoney(detailRow.linkedDeductionRemainingBalance ?? 0)}
                      </p>
                    </div>
                  </div>
                ) : detailRow.requestType === "LEAVE" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Employee
                      </p>
                      <p className="mt-2 font-medium">{detailRow.employeeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {detailRow.employeeCode}
                      </p>
                    </div>
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
                      <p className="mt-2 font-medium">{detailRow.scheduleLabel}</p>
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
                      {getDetailLeaveDateLists(detailRow).paidDates.length > 0 ? (
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {getDetailLeaveDateLists(detailRow).paidDates.map((date) => (
                            <p key={`paid-${date}`}>
                              {detailRow.status === "PENDING_MANAGER"
                                ? formatDateKey(date)
                                : formatDate(date)}
                            </p>
                          ))}
                        </div>
                      ) : detailRow.status === "APPROVED" ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No paid leave dates were assigned.
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No dates are currently marked as paid.
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Unpaid Dates
                      </p>
                      {getDetailLeaveDateLists(detailRow).unpaidDates.length > 0 ? (
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {getDetailLeaveDateLists(detailRow).unpaidDates.map((date) => (
                            <p key={`unpaid-${date}`}>
                              {detailRow.status === "PENDING_MANAGER"
                                ? formatDateKey(date)
                                : formatDate(date)}
                            </p>
                          ))}
                        </div>
                      ) : detailRow.status === "APPROVED" ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No unpaid leave dates were assigned.
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No dates are currently marked as unpaid.
                        </p>
                      )}
                    </div>
                  </div>
                ) : detailRow.requestType === "DAY_OFF" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Employee
                      </p>
                      <p className="mt-2 font-medium">{detailRow.employeeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {detailRow.employeeCode}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Work Date
                      </p>
                      <p className="mt-2 font-medium">{detailRow.workDateLabel}</p>
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
                        Employee
                      </p>
                      <p className="mt-2 font-medium">{detailRow.employeeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {detailRow.employeeCode}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Work Date
                      </p>
                      <p className="mt-2 font-medium">{detailRow.workDateLabel}</p>
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
                      <p className="mt-2 font-medium">{detailRow.workDateLabel}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Requester
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.requesterEmployeeName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {detailRow.requesterEmployeeCode}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Coworker
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.coworkerEmployeeName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {detailRow.coworkerEmployeeCode}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Requester Shift
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.requesterShiftLabel}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Coworker Shift
                      </p>
                      <p className="mt-2 font-medium">
                        {detailRow.coworkerShiftLabel}
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
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
