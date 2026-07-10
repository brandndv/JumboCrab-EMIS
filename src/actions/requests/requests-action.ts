"use server";

import {
  listCashAdvanceRequests as listCashAdvanceRequestsImpl,
} from "./requests-cash-advance-list-action";
import {
  createGovernmentLoanAssistanceRequest as createGovernmentLoanAssistanceRequestImpl,
  finalizeGovernmentLoanAssistanceRequest as finalizeGovernmentLoanAssistanceRequestImpl,
  listGovernmentLoanAssistanceRequests as listGovernmentLoanAssistanceRequestsImpl,
  updateGovernmentLoanAssistanceStatus as updateGovernmentLoanAssistanceStatusImpl,
} from "./requests-government-loan-action";
import {
  getEmployeeLeaveBalanceSummary as getEmployeeLeaveBalanceSummaryImpl,
  listLeaveRequests as listLeaveRequestsImpl,
} from "./requests-leave-list-action";
import {
  createSilEncashmentRequest as createSilEncashmentRequestImpl,
  listSilEncashmentRequests as listSilEncashmentRequestsImpl,
  reviewSilEncashmentRequest as reviewSilEncashmentRequestImpl,
} from "./requests-sil-encashment-action";
import {
  listEmployeeLeaveCreditLedger as listEmployeeLeaveCreditLedgerImpl,
  listLeaveCreditPolicies as listLeaveCreditPoliciesImpl,
  listLeaveCreditResetRuns as listLeaveCreditResetRunsImpl,
  runLeaveCreditReset as runLeaveCreditResetImpl,
  updateLeaveCreditPolicy as updateLeaveCreditPolicyImpl,
} from "./requests-leave-credit-action";
import {
  getEmployeeDayOffMonthlySummary as getEmployeeDayOffMonthlySummaryImpl,
  listDayOffRequests as listDayOffRequestsImpl,
} from "./requests-day-off-list-action";
import {
  listEmployeesForScheduleSwap as listEmployeesForScheduleSwapImpl,
  listScheduleChangeRequests as listScheduleChangeRequestsImpl,
  listScheduleChangeShifts as listScheduleChangeShiftsImpl,
  listScheduleSwapRequests as listScheduleSwapRequestsImpl,
} from "./requests-schedule-list-action";
import {
  getDayOffPreview as getDayOffPreviewImpl,
  getScheduleChangePreview as getScheduleChangePreviewImpl,
  getScheduleSwapPreview as getScheduleSwapPreviewImpl,
} from "./requests-preview-action";
import {
  createCashAdvanceRequest as createCashAdvanceRequestImpl,
} from "./requests-cash-advance-create-action";
import {
  createLeaveRequest as createLeaveRequestImpl,
} from "./requests-leave-create-action";
import {
  createDayOffRequest as createDayOffRequestImpl,
} from "./requests-day-off-create-action";
import {
  createScheduleChangeRequest as createScheduleChangeRequestImpl,
} from "./requests-schedule-change-create-action";
import {
  createScheduleSwapRequest as createScheduleSwapRequestImpl,
} from "./requests-schedule-swap-create-action";
import {
  respondToScheduleSwapRequest as respondToScheduleSwapRequestImpl,
  reviewScheduleSwapRequest as reviewScheduleSwapRequestImpl,
} from "./requests-swap-review-action";
import { softDeleteRequest as softDeleteRequestImpl } from "./requests-soft-delete-action";
import { reviewDayOffRequest as reviewDayOffRequestImpl } from "./requests-day-off-review-action";
import { reviewScheduleChangeRequest as reviewScheduleChangeRequestImpl } from "./requests-schedule-change-review-action";
import { reviewCashAdvanceRequest as reviewCashAdvanceRequestImpl } from "./requests-cash-advance-review-action";
import { reviewLeaveRequest as reviewLeaveRequestImpl } from "./requests-leave-review-action";

export async function listCashAdvanceRequests(
  ...args: Parameters<typeof listCashAdvanceRequestsImpl>
) {
  return listCashAdvanceRequestsImpl(...args);
}

export async function listGovernmentLoanAssistanceRequests(
  ...args: Parameters<typeof listGovernmentLoanAssistanceRequestsImpl>
) {
  return listGovernmentLoanAssistanceRequestsImpl(...args);
}

export async function listLeaveRequests(
  ...args: Parameters<typeof listLeaveRequestsImpl>
) {
  return listLeaveRequestsImpl(...args);
}

export async function listSilEncashmentRequests(
  ...args: Parameters<typeof listSilEncashmentRequestsImpl>
) {
  return listSilEncashmentRequestsImpl(...args);
}

export async function getEmployeeLeaveBalanceSummary(
  ...args: Parameters<typeof getEmployeeLeaveBalanceSummaryImpl>
) {
  return getEmployeeLeaveBalanceSummaryImpl(...args);
}

export async function getEmployeeDayOffMonthlySummary(
  ...args: Parameters<typeof getEmployeeDayOffMonthlySummaryImpl>
) {
  return getEmployeeDayOffMonthlySummaryImpl(...args);
}

export async function listLeaveCreditPolicies(
  ...args: Parameters<typeof listLeaveCreditPoliciesImpl>
) {
  return listLeaveCreditPoliciesImpl(...args);
}

export async function updateLeaveCreditPolicy(
  ...args: Parameters<typeof updateLeaveCreditPolicyImpl>
) {
  return updateLeaveCreditPolicyImpl(...args);
}

export async function runLeaveCreditReset(
  ...args: Parameters<typeof runLeaveCreditResetImpl>
) {
  return runLeaveCreditResetImpl(...args);
}

export async function listLeaveCreditResetRuns(
  ...args: Parameters<typeof listLeaveCreditResetRunsImpl>
) {
  return listLeaveCreditResetRunsImpl(...args);
}

export async function listEmployeeLeaveCreditLedger(
  ...args: Parameters<typeof listEmployeeLeaveCreditLedgerImpl>
) {
  return listEmployeeLeaveCreditLedgerImpl(...args);
}

export async function listDayOffRequests(
  ...args: Parameters<typeof listDayOffRequestsImpl>
) {
  return listDayOffRequestsImpl(...args);
}

export async function listEmployeesForScheduleSwap(
  ...args: Parameters<typeof listEmployeesForScheduleSwapImpl>
) {
  return listEmployeesForScheduleSwapImpl(...args);
}

export async function listScheduleChangeShifts(
  ...args: Parameters<typeof listScheduleChangeShiftsImpl>
) {
  return listScheduleChangeShiftsImpl(...args);
}

export async function listScheduleChangeRequests(
  ...args: Parameters<typeof listScheduleChangeRequestsImpl>
) {
  return listScheduleChangeRequestsImpl(...args);
}

export async function listScheduleSwapRequests(
  ...args: Parameters<typeof listScheduleSwapRequestsImpl>
) {
  return listScheduleSwapRequestsImpl(...args);
}

export async function getDayOffPreview(
  ...args: Parameters<typeof getDayOffPreviewImpl>
) {
  return getDayOffPreviewImpl(...args);
}

export async function getScheduleSwapPreview(
  ...args: Parameters<typeof getScheduleSwapPreviewImpl>
) {
  return getScheduleSwapPreviewImpl(...args);
}

export async function getScheduleChangePreview(
  ...args: Parameters<typeof getScheduleChangePreviewImpl>
) {
  return getScheduleChangePreviewImpl(...args);
}

export async function createCashAdvanceRequest(
  ...args: Parameters<typeof createCashAdvanceRequestImpl>
) {
  return createCashAdvanceRequestImpl(...args);
}

export async function createGovernmentLoanAssistanceRequest(
  ...args: Parameters<typeof createGovernmentLoanAssistanceRequestImpl>
) {
  return createGovernmentLoanAssistanceRequestImpl(...args);
}

export async function createLeaveRequest(
  ...args: Parameters<typeof createLeaveRequestImpl>
) {
  return createLeaveRequestImpl(...args);
}

export async function createSilEncashmentRequest(
  ...args: Parameters<typeof createSilEncashmentRequestImpl>
) {
  return createSilEncashmentRequestImpl(...args);
}

export async function createDayOffRequest(
  ...args: Parameters<typeof createDayOffRequestImpl>
) {
  return createDayOffRequestImpl(...args);
}

export async function createScheduleChangeRequest(
  ...args: Parameters<typeof createScheduleChangeRequestImpl>
) {
  return createScheduleChangeRequestImpl(...args);
}

export async function createScheduleSwapRequest(
  ...args: Parameters<typeof createScheduleSwapRequestImpl>
) {
  return createScheduleSwapRequestImpl(...args);
}

export async function respondToScheduleSwapRequest(
  ...args: Parameters<typeof respondToScheduleSwapRequestImpl>
) {
  return respondToScheduleSwapRequestImpl(...args);
}

export async function reviewScheduleSwapRequest(
  ...args: Parameters<typeof reviewScheduleSwapRequestImpl>
) {
  return reviewScheduleSwapRequestImpl(...args);
}

export async function reviewDayOffRequest(
  ...args: Parameters<typeof reviewDayOffRequestImpl>
) {
  return reviewDayOffRequestImpl(...args);
}

export async function reviewScheduleChangeRequest(
  ...args: Parameters<typeof reviewScheduleChangeRequestImpl>
) {
  return reviewScheduleChangeRequestImpl(...args);
}

export async function reviewCashAdvanceRequest(
  ...args: Parameters<typeof reviewCashAdvanceRequestImpl>
) {
  return reviewCashAdvanceRequestImpl(...args);
}

export async function updateGovernmentLoanAssistanceStatus(
  ...args: Parameters<typeof updateGovernmentLoanAssistanceStatusImpl>
) {
  return updateGovernmentLoanAssistanceStatusImpl(...args);
}

export async function finalizeGovernmentLoanAssistanceRequest(
  ...args: Parameters<typeof finalizeGovernmentLoanAssistanceRequestImpl>
) {
  return finalizeGovernmentLoanAssistanceRequestImpl(...args);
}

export async function softDeleteRequest(
  ...args: Parameters<typeof softDeleteRequestImpl>
) {
  return softDeleteRequestImpl(...args);
}

export async function reviewLeaveRequest(
  ...args: Parameters<typeof reviewLeaveRequestImpl>
) {
  return reviewLeaveRequestImpl(...args);
}

export async function reviewSilEncashmentRequest(
  ...args: Parameters<typeof reviewSilEncashmentRequestImpl>
) {
  return reviewSilEncashmentRequestImpl(...args);
}

export type {
  CashAdvanceRequestPayload,
  CashAdvanceRequestRow,
  DayOffPreview,
  DayOffRequestPayload,
  DayOffRequestRow,
  GovernmentLoanAssistanceRequestPayload,
  GovernmentLoanAssistanceRequestRow,
  GovernmentLoanChecklistItem,
  GovernmentLoanFinalizePayload,
  GovernmentLoanStatusUpdatePayload,
  EmployeeLeaveCreditLedgerRow,
  EmployeeDayOffMonthlySummary,
  EmployeeLeaveBalanceSummary,
  LeaveCreditPolicyRow,
  LeaveCreditResetRunRow,
  LeaveRequestPayload,
  LeaveRequestRow,
  RequestReviewPayload,
  RequestSoftDeletePayload,
  SilEncashmentRequestPayload,
  SilEncashmentRequestRow,
  SilEncashmentReviewPayload,
  ScheduleChangePreview,
  ScheduleChangeRequestPayload,
  ScheduleChangeRequestRow,
  ScheduleChangeShiftOption,
  ScheduleSwapCoworkerReviewPayload,
  ScheduleSwapEmployeeOption,
  ScheduleSwapPreview,
  ScheduleSwapRequestPayload,
  ScheduleSwapRequestRow,
} from "./types";
