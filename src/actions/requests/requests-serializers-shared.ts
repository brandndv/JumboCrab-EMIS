import { Prisma } from "@prisma/client";
import {
  employeeRequestSelect,
  enumerateZonedDaysInclusive,
  reviewedBySelect,
  toEmployeeName,
} from "./requests-core-shared";
import { formatShiftSnapshotLabel } from "./requests-schedule-shared";
import type {
  CashAdvanceRequestRow,
  DayOffRequestRow,
  LeaveRequestRow,
  ScheduleChangeRequestRow,
  ScheduleSwapRequestRow,
} from "./types";

const toIsoString = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

const toNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type CashAdvanceRequestRecord = Prisma.CashAdvanceRequestGetPayload<{
  include: {
    employee: { select: typeof employeeRequestSelect };
    reviewedBy: { select: typeof reviewedBySelect };
    deductionAssignment: {
      select: {
        id: true;
        status: true;
        effectiveFrom: true;
        remainingBalance: true;
      };
    };
  };
}>;

type LeaveRequestRecord = Prisma.LeaveRequestGetPayload<{
  include: {
    employee: { select: typeof employeeRequestSelect };
    reviewedBy: { select: typeof reviewedBySelect };
    attendances: {
      select: {
        workDate: true;
        isPaidLeave: true;
      };
    };
  };
}>;

type DayOffRequestRecord = Prisma.DayOffRequestGetPayload<{
  include: {
    employee: { select: typeof employeeRequestSelect };
    reviewedBy: { select: typeof reviewedBySelect };
  };
}>;

type ScheduleChangeRequestRecord = Prisma.ScheduleChangeRequestGetPayload<{
  include: {
    employee: { select: typeof employeeRequestSelect };
    reviewedBy: { select: typeof reviewedBySelect };
  };
}>;

type ScheduleSwapRequestRecord = Prisma.ScheduleSwapRequestGetPayload<{
  include: {
    requesterEmployee: { select: typeof employeeRequestSelect };
    coworkerEmployee: { select: typeof employeeRequestSelect };
    reviewedBy: { select: typeof reviewedBySelect };
  };
}>;

export const serializeCashAdvanceRequest = (
  row: CashAdvanceRequestRecord,
): CashAdvanceRequestRow => ({
  id: row.id,
  employeeId: row.employeeId,
  employeeCode: row.employee.employeeCode,
  employeeName: toEmployeeName(row.employee),
  amount: toNumber(row.amount) ?? 0,
  repaymentPerPayroll: toNumber(row.repaymentPerPayroll) ?? 0,
  preferredStartDate: row.preferredStartDate.toISOString(),
  reason: row.reason ?? null,
  status: row.status,
  managerRemarks: row.managerRemarks ?? null,
  reviewedByName: row.reviewedBy?.username ?? null,
  reviewedAt: toIsoString(row.reviewedAt),
  submittedAt: row.submittedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  deductionAssignmentId: row.deductionAssignmentId ?? null,
  linkedDeductionStatus: row.deductionAssignment?.status ?? null,
  linkedDeductionEffectiveFrom: toIsoString(
    row.deductionAssignment?.effectiveFrom,
  ),
  linkedDeductionRemainingBalance: toNumber(
    row.deductionAssignment?.remainingBalance,
  ),
});

export const serializeLeaveRequest = (
  row: LeaveRequestRecord,
): LeaveRequestRow => {
  const sortedAttendances = [...row.attendances].sort(
    (left, right) => left.workDate.getTime() - right.workDate.getTime(),
  );
  const paidDateList = sortedAttendances
    .filter((attendance) => attendance.isPaidLeave)
    .map((attendance) => attendance.workDate.toISOString());
  const unpaidDateList = sortedAttendances
    .filter((attendance) => !attendance.isPaidLeave)
    .map((attendance) => attendance.workDate.toISOString());

  return {
    paidDaysCount: paidDateList.length,
    unpaidDaysCount: unpaidDateList.length,
    paidDateList,
    unpaidDateList,
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: row.employee.employeeCode,
    employeeName: toEmployeeName(row.employee),
    leaveType: row.leaveType,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    reason: row.reason ?? null,
    status: row.status,
    managerRemarks: row.managerRemarks ?? null,
    reviewedByName: row.reviewedBy?.username ?? null,
    reviewedAt: toIsoString(row.reviewedAt),
    submittedAt: row.submittedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    totalDays: enumerateZonedDaysInclusive(row.startDate, row.endDate).length,
  };
};

export const serializeDayOffRequest = (
  row: DayOffRequestRecord,
): DayOffRequestRow => ({
  id: row.id,
  employeeId: row.employeeId,
  employeeCode: row.employee.employeeCode,
  employeeName: toEmployeeName(row.employee),
  workDate: row.workDate.toISOString(),
  currentShiftLabel: formatShiftSnapshotLabel({
    shiftCode: row.currentShiftCodeSnapshot,
    shiftName: row.currentShiftNameSnapshot,
    startMinutes: row.currentStartMinutesSnapshot,
    endMinutes: row.currentEndMinutesSnapshot,
  }),
  reason: row.reason ?? null,
  status: row.status,
  managerRemarks: row.managerRemarks ?? null,
  reviewedByName: row.reviewedBy?.username ?? null,
  reviewedAt: toIsoString(row.reviewedAt),
  submittedAt: row.submittedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const serializeScheduleChangeRequest = (
  row: ScheduleChangeRequestRecord,
): ScheduleChangeRequestRow => ({
  id: row.id,
  employeeId: row.employeeId,
  employeeCode: row.employee.employeeCode,
  employeeName: toEmployeeName(row.employee),
  workDate: row.workDate.toISOString(),
  currentShiftLabel: formatShiftSnapshotLabel({
    shiftCode: row.currentShiftCodeSnapshot,
    shiftName: row.currentShiftNameSnapshot,
    startMinutes: row.currentStartMinutesSnapshot,
    endMinutes: row.currentEndMinutesSnapshot,
  }),
  requestedShiftLabel: formatShiftSnapshotLabel({
    shiftCode: row.requestedShiftCodeSnapshot,
    shiftName: row.requestedShiftNameSnapshot,
    startMinutes: row.requestedStartMinutesSnapshot,
    endMinutes: row.requestedEndMinutesSnapshot,
  }),
  requestedShiftId: row.requestedShiftId,
  reason: row.reason ?? null,
  status: row.status,
  managerRemarks: row.managerRemarks ?? null,
  reviewedByName: row.reviewedBy?.username ?? null,
  reviewedAt: toIsoString(row.reviewedAt),
  submittedAt: row.submittedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const serializeScheduleSwapRequest = (
  row: ScheduleSwapRequestRecord,
  viewerEmployeeId?: string | null,
): ScheduleSwapRequestRow => ({
  id: row.id,
  requesterEmployeeId: row.requesterEmployeeId,
  requesterEmployeeCode: row.requesterEmployee.employeeCode,
  requesterEmployeeName: toEmployeeName(row.requesterEmployee),
  coworkerEmployeeId: row.coworkerEmployeeId,
  coworkerEmployeeCode: row.coworkerEmployee.employeeCode,
  coworkerEmployeeName: toEmployeeName(row.coworkerEmployee),
  workDate: row.workDate.toISOString(),
  requesterShiftLabel: formatShiftSnapshotLabel({
    shiftCode: row.requesterShiftCodeSnapshot,
    shiftName: row.requesterShiftNameSnapshot,
    startMinutes: row.requesterStartMinutesSnapshot,
    endMinutes: row.requesterEndMinutesSnapshot,
  }),
  coworkerShiftLabel: formatShiftSnapshotLabel({
    shiftCode: row.coworkerShiftCodeSnapshot,
    shiftName: row.coworkerShiftNameSnapshot,
    startMinutes: row.coworkerStartMinutesSnapshot,
    endMinutes: row.coworkerEndMinutesSnapshot,
  }),
  reason: row.reason ?? null,
  status: row.status,
  coworkerRemarks: row.coworkerRemarks ?? null,
  managerRemarks: row.managerRemarks ?? null,
  reviewedByName: row.reviewedBy?.username ?? null,
  reviewedAt: toIsoString(row.reviewedAt),
  coworkerRespondedAt: toIsoString(row.coworkerRespondedAt),
  submittedAt: row.submittedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  isIncomingToViewer:
    Boolean(viewerEmployeeId) && row.coworkerEmployeeId === viewerEmployeeId,
  isOutgoingFromViewer:
    Boolean(viewerEmployeeId) && row.requesterEmployeeId === viewerEmployeeId,
});
