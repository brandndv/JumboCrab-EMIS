"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listCashAdvanceRequests,
  listDayOffRequests,
  listGovernmentLoanAssistanceRequests,
  listLeaveRequests,
  listSilEncashmentRequests,
  listScheduleChangeRequests,
  listScheduleSwapRequests,
  reviewCashAdvanceRequest,
  reviewDayOffRequest,
  finalizeGovernmentLoanAssistanceRequest,
  reviewLeaveRequest,
  reviewSilEncashmentRequest,
  reviewScheduleChangeRequest,
  reviewScheduleSwapRequest,
  updateGovernmentLoanAssistanceStatus,
  type CashAdvanceRequestRow,
  type DayOffRequestRow,
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
import { Input } from "@/components/ui/input";
import { ModuleLoadingState } from "@/components/loading/loading-states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";

type ManagerRequestRow =
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

export default function ManagerRequestsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagerRequestRow[]>([]);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const [managerRemarks, setManagerRemarks] = useState<Record<string, string>>({});
  const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({});
  const [approvedEffectiveDates, setApprovedEffectiveDates] = useState<Record<string, string>>({});
  const [agencyRemarks, setAgencyRemarks] = useState<Record<string, string>>({});
  const [loanApprovedAmounts, setLoanApprovedAmounts] = useState<Record<string, string>>({});
  const [loanApprovedMonthlyPayments, setLoanApprovedMonthlyPayments] = useState<Record<string, string>>({});
  const [loanRepaymentStartDates, setLoanRepaymentStartDates] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
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
      setError(err instanceof Error ? err.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingRows = useMemo(
    () =>
      rows.filter((row) =>
        row.requestType === "GOVERNMENT_LOAN"
          ? [
              "PENDING_MANAGER_REVIEW",
              "PROCESSING",
              "APPROVED_BY_AGENCY",
            ].includes(row.status)
          : row.requestType === "SIL_ENCASHMENT"
            ? row.status === "PENDING_MANAGER"
          : row.status === "PENDING_MANAGER",
      ),
    [rows],
  );

  const reviewedRows = useMemo(
    () =>
      rows.filter((row) =>
        row.requestType === "GOVERNMENT_LOAN"
          ? ![
              "PENDING_MANAGER_REVIEW",
              "PROCESSING",
              "APPROVED_BY_AGENCY",
            ].includes(row.status)
          : row.requestType === "SIL_ENCASHMENT"
            ? row.status !== "PENDING_MANAGER"
          : row.status !== "PENDING_MANAGER",
      ),
    [rows],
  );

  const reviewRow = async (
    row: ManagerRequestRow,
    decision: "APPROVED" | "REJECTED",
  ) => {
    try {
      setReviewingKey(`${row.requestType}:${row.id}:${decision}`);
      const common = {
        id: row.id,
        decision,
        managerRemarks: managerRemarks[row.id] ?? "",
      };
      const result =
        row.requestType === "CASH_ADVANCE"
          ? await reviewCashAdvanceRequest({
              ...common,
              approvedAmount: approvedAmounts[row.id] || String(row.amount),
              deductionMode: "FULL_NEXT_PAYROLL",
              approvedRepaymentPerPayroll: approvedAmounts[row.id] || String(row.amount),
              approvedEffectiveFrom:
                approvedEffectiveDates[row.id] ||
                row.preferredStartDate.slice(0, 10),
            })
          : row.requestType === "LEAVE"
            ? await reviewLeaveRequest(common)
            : row.requestType === "SIL_ENCASHMENT"
              ? await reviewSilEncashmentRequest(common)
            : row.requestType === "DAY_OFF"
              ? await reviewDayOffRequest(common)
              : row.requestType === "SCHEDULE_CHANGE"
                ? await reviewScheduleChangeRequest(common)
                : await reviewScheduleSwapRequest(common);

      if (!result.success) {
        throw new Error(result.error || "Failed to review request.");
      }

      toast.success(
        decision === "APPROVED" ? "Request approved" : "Request rejected",
        {
          description: `${requestTypeLabel(row.requestType)} review saved.`,
        },
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review request.");
    } finally {
      setReviewingKey(null);
    }
  };

  const updateGovernmentLoanRow = async (
    row: Extract<ManagerRequestRow, { requestType: "GOVERNMENT_LOAN" }>,
    status: "PROCESSING" | "APPROVED_BY_AGENCY" | "DECLINED_BY_AGENCY",
  ) => {
    try {
      setReviewingKey(`${row.requestType}:${row.id}:${status}`);
      const result = await updateGovernmentLoanAssistanceStatus({
        id: row.id,
        status,
        managerRemarks: managerRemarks[row.id] ?? "",
        agencyRemarks: agencyRemarks[row.id] ?? "",
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to update request.");
      }
      toast.success(
        status === "PROCESSING"
          ? "Request marked processing"
          : status === "APPROVED_BY_AGENCY"
            ? "Agency approval recorded"
          : "Agency decline recorded",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update request.");
    } finally {
      setReviewingKey(null);
    }
  };

  const finalizeGovernmentLoanRow = async (
    row: Extract<ManagerRequestRow, { requestType: "GOVERNMENT_LOAN" }>,
  ) => {
    try {
      setReviewingKey(`${row.requestType}:${row.id}:RECORDED`);
      const result = await finalizeGovernmentLoanAssistanceRequest({
        id: row.id,
        approvedAmount:
          loanApprovedAmounts[row.id] || String(row.requestedAmount),
        approvedMonthlyPayment:
          loanApprovedMonthlyPayments[row.id] ||
          String(row.estimatedMonthlyDeduction),
        repaymentStartDate:
          loanRepaymentStartDates[row.id] ||
          new Date().toISOString().slice(0, 10),
        managerRemarks: managerRemarks[row.id] ?? "",
        agencyRemarks: agencyRemarks[row.id] ?? "",
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to record loan in payroll.");
      }
      toast.success("Government loan recorded in payroll");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record loan in payroll.",
      );
    } finally {
      setReviewingKey(null);
    }
  };

  const renderRequestBody = (row: ManagerRequestRow) => {
    if (row.requestType === "LEAVE") {
      return (
        <div className="space-y-1 text-sm">
          <p className="font-medium">{leaveTypeLabel(row.leaveType)}</p>
          <p className="text-muted-foreground">
            {formatDateRange(row.startDate, row.endDate)} · {row.totalDays} day(s)
          </p>
          <p className="text-muted-foreground">
            Credit usage: {row.creditDaysUsed}
          </p>
        </div>
      );
    }

    if (row.requestType === "SIL_ENCASHMENT") {
      return (
        <div className="space-y-1 text-sm">
          <p className="font-medium">{row.days} SIL day(s) for encashment</p>
          <p className="text-muted-foreground">
            {row.status === "APPROVED"
              ? "Approved and deducted from SIL credits."
              : row.status === "REJECTED"
                ? "Rejected by manager."
                : "Waiting for manager approval."}
          </p>
          {row.ledgerEntryId ? (
            <p className="text-muted-foreground">Leave credit ledger recorded.</p>
          ) : null}
        </div>
      );
    }

    if (row.requestType === "DAY_OFF") {
      return (
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            Move OFF from {formatDate(row.sourceOffDate)} to {formatDate(row.targetWorkDate)}
          </p>
          <p className="text-muted-foreground">
            Source: {row.sourceShiftLabel} · Target: {row.targetShiftLabel}
          </p>
        </div>
      );
    }

    if (row.requestType === "SCHEDULE_CHANGE") {
      return (
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            {formatDateRange(row.startDate, row.endDate)} · {row.totalDays} day(s)
          </p>
          <p className="text-muted-foreground">Requested shift: {row.requestedShiftLabel}</p>
        </div>
      );
    }

    if (row.requestType === "SCHEDULE_SWAP") {
      return (
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            {formatDate(row.workDate)} · {row.requesterEmployeeName} ↔ {row.coworkerEmployeeName}
          </p>
          <p className="text-muted-foreground">
            {row.requesterEmployeeName}: {row.requesterShiftLabel}
          </p>
          <p className="text-muted-foreground">
            {row.coworkerEmployeeName}: {row.coworkerShiftLabel}
          </p>
        </div>
      );
    }

    if (row.requestType === "GOVERNMENT_LOAN") {
      const isPayrollRecorded = row.status === "RECORDED_IN_PAYROLL";
      const canEditAgencyFields =
        row.status === "PROCESSING" || row.status === "APPROVED_BY_AGENCY";
      return (
        <div className="space-y-4 text-sm">
          <div className="space-y-1">
            <p className="font-medium">
              {row.agencyLabel} · {formatMoney(row.requestedAmount)}
            </p>
            <p className="text-muted-foreground">
              {row.termMonths} months · Est. monthly{" "}
              {formatMoney(row.estimatedMonthlyDeduction)} · Est. per payroll{" "}
              {formatMoney(row.estimatedPerPayrollDeduction)}
            </p>
            <p className="text-muted-foreground">
              ID snapshot: {row.governmentIdSnapshot}
            </p>
          </div>
          {canEditAgencyFields ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Approved amount
                  </label>
                  <Input
                    value={loanApprovedAmounts[row.id] ?? String(row.approvedAmount ?? row.requestedAmount)}
                    onChange={(event) =>
                      setLoanApprovedAmounts((current) => ({
                        ...current,
                        [row.id]: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Monthly payment
                  </label>
                  <Input
                    value={
                      loanApprovedMonthlyPayments[row.id] ??
                      String(row.approvedMonthlyPayment ?? row.estimatedMonthlyDeduction)
                    }
                    onChange={(event) =>
                      setLoanApprovedMonthlyPayments((current) => ({
                        ...current,
                        [row.id]: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Repayment start
                  </label>
                  <Input
                    type="date"
                    value={
                      loanRepaymentStartDates[row.id] ??
                      (row.repaymentStartDate
                        ? row.repaymentStartDate.slice(0, 10)
                        : new Date().toISOString().slice(0, 10))
                    }
                    onChange={(event) =>
                      setLoanRepaymentStartDates((current) => ({
                        ...current,
                        [row.id]: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <Textarea
                rows={2}
                placeholder="Agency remarks"
                value={agencyRemarks[row.id] ?? row.agencyRemarks ?? ""}
                onChange={(event) =>
                  setAgencyRemarks((current) => ({
                    ...current,
                    [row.id]: event.target.value,
                  }))
                }
              />
            </>
          ) : row.approvedAmount || isPayrollRecorded ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Approved amount
                </p>
                <p className="mt-1 font-medium">{formatMoney(row.approvedAmount ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Monthly payment
                </p>
                <p className="mt-1 font-medium">
                  {formatMoney(row.approvedMonthlyPayment ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Repayment start
                </p>
                <p className="mt-1 font-medium">{formatDate(row.repaymentStartDate)}</p>
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
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-muted-foreground">
            If the agency requires employer certification, signed documents, or
            net-pay confirmation, assist the employee before recording the final result.
          </div>
          {row.linkedDeductionStatus ? (
            <p className="text-muted-foreground">
              Linked deduction: {linkedDeductionStatusLabel(row.linkedDeductionStatus)}
            </p>
          ) : null}
        </div>
      );
    }

    const isCashAdvanceEditable = row.status === "PENDING_MANAGER";

    if (!isCashAdvanceEditable) {
      return (
        <div className="space-y-2 text-sm">
          <p className="font-medium">{formatMoney(row.amount)}</p>
          {row.status === "APPROVED" ? (
            <p className="text-muted-foreground">
              Approved {formatMoney(row.approvedAmount ?? row.amount)} ·{" "}
              {row.approvedDeductionMode === "INSTALLMENTS"
                ? `Installments ${formatMoney(row.approvedRepaymentPerPayroll ?? 0)}`
                : "Full next payroll"}{" "}
              · Effective {formatDate(row.approvedEffectiveFrom)}
            </p>
          ) : null}
          {row.linkedDeductionStatus ? (
            <p className="text-muted-foreground">
              Linked deduction: {linkedDeductionStatusLabel(row.linkedDeductionStatus)}
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">{formatMoney(row.amount)}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Approved amount
            </label>
            <Input
              value={approvedAmounts[row.id] ?? String(row.amount)}
              onChange={(event) =>
                setApprovedAmounts((current) => ({
                  ...current,
                  [row.id]: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Deduction mode
            </label>
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              Full next payroll
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Effective date
            </label>
            <Input
              type="date"
              value={approvedEffectiveDates[row.id] ?? row.preferredStartDate.slice(0, 10)}
              onChange={(event) =>
                setApprovedEffectiveDates((current) => ({
                  ...current,
                  [row.id]: event.target.value,
                }))
              }
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Current policy allows cash advance requests only as one-time deductions on the next payroll.
        </p>
        {row.linkedDeductionStatus ? (
          <p className="text-muted-foreground">
            Linked deduction: {linkedDeductionStatusLabel(row.linkedDeductionStatus)}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <Card className="shadow-sm">
        <CardHeader className="p-5 sm:p-6">
          <div>
            <CardTitle>Requests</CardTitle>
            <p className="text-sm text-muted-foreground">
              Simplified request review for leave, day-off transfers, shift changes,
              swap requests, cash advances, and government loan assistance.
            </p>
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-4">
          <CardTitle>Pending Review</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
          {loading ? (
            <ModuleLoadingState
              title="Loading manager requests"
              description="Fetching pending and reviewed employee requests."
            />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : pendingRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            <div className="space-y-3">
              {pendingRows.map((row) => (
                <div key={`${row.requestType}:${row.id}`} className="rounded-xl border border-border/70 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{requestTypeLabel(row.requestType)}</p>
                        <Badge variant="outline" className={requestStatusClass(row.status)}>
                          {requestStatusLabel(row.status)}
                        </Badge>
                      </div>
                      {"employeeName" in row ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.employeeName} · {row.employeeCode}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.requesterEmployeeName} · {row.requesterEmployeeCode}
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Submitted {formatDate(row.submittedAt)}
                    </p>
                  </div>

                  <div className="mt-3">{renderRequestBody(row)}</div>

                  {"reason" in row && row.reason ? (
                    <p className="mt-3 text-sm text-muted-foreground">{row.reason}</p>
                  ) : null}
                  {row.requestType === "GOVERNMENT_LOAN" && row.employeeRemarks ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {row.employeeRemarks}
                    </p>
                  ) : null}

                  <Textarea
                    className="mt-3"
                    rows={3}
                    placeholder="Manager remarks"
                    value={managerRemarks[row.id] ?? ""}
                    onChange={(event) =>
                      setManagerRemarks((current) => ({
                        ...current,
                        [row.id]: event.target.value,
                      }))
                    }
                  />

                  {row.requestType === "GOVERNMENT_LOAN" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.status === "PENDING_MANAGER_REVIEW" ? (
                        <Button
                          variant="outline"
                          disabled={
                            reviewingKey === `${row.requestType}:${row.id}:PROCESSING`
                          }
                          onClick={() => void updateGovernmentLoanRow(row, "PROCESSING")}
                        >
                          Mark Processing
                        </Button>
                      ) : null}
                      {row.status === "PROCESSING" ? (
                        <>
                          <Button
                            disabled={
                              reviewingKey ===
                              `${row.requestType}:${row.id}:APPROVED_BY_AGENCY`
                            }
                            onClick={() =>
                              void updateGovernmentLoanRow(row, "APPROVED_BY_AGENCY")
                            }
                          >
                            Agency Approved
                          </Button>
                          <Button
                            variant="outline"
                            disabled={
                              reviewingKey ===
                              `${row.requestType}:${row.id}:DECLINED_BY_AGENCY`
                            }
                            onClick={() =>
                              void updateGovernmentLoanRow(row, "DECLINED_BY_AGENCY")
                            }
                          >
                            Agency Declined
                          </Button>
                        </>
                      ) : null}
                      {row.status === "APPROVED_BY_AGENCY" ? (
                        <Button
                          disabled={
                            reviewingKey === `${row.requestType}:${row.id}:RECORDED`
                          }
                          onClick={() => void finalizeGovernmentLoanRow(row)}
                        >
                          Record Payroll
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <Button
                        disabled={reviewingKey === `${row.requestType}:${row.id}:APPROVED`}
                        onClick={() => void reviewRow(row, "APPROVED")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        disabled={reviewingKey === `${row.requestType}:${row.id}:REJECTED`}
                        onClick={() => void reviewRow(row, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-4">
          <CardTitle>Reviewed</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
          {loading ? null : reviewedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviewed requests yet.</p>
          ) : (
            <div className="space-y-3">
              {reviewedRows.map((row) => (
                <div key={`${row.requestType}:${row.id}`} className="rounded-xl border border-border/70 p-4">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{requestTypeLabel(row.requestType)}</p>
                    <Badge variant="outline" className={requestStatusClass(row.status)}>
                      {requestStatusLabel(row.status)}
                    </Badge>
                  </div>
                  {"employeeName" in row ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.employeeName} · {row.employeeCode}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.requesterEmployeeName} · {row.requesterEmployeeCode}
                    </p>
                  )}
                  <div className="mt-3">{renderRequestBody(row)}</div>
                  {row.managerRemarks ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Remarks: {row.managerRemarks}
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
