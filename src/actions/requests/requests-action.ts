"use server";

import { revalidatePath } from "next/cache";
import {
  ATTENDANCE_STATUS,
  CURRENT_STATUS,
  CashAdvanceRequestStatus,
  DayOffRequestStatus,
  DeductionAmountMode,
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  Prisma,
  Roles,
  ScheduleChangeRequestStatus,
  ScheduleSwapRequestStatus,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExpectedShiftForDate } from "@/lib/attendance";
import { startOfZonedDay } from "@/lib/timezone";
import {
  cashAdvanceRequestSchema,
  cashAdvanceReviewSchema,
  dayOffRequestSchema,
  leaveRequestSchema,
  leaveReviewSchema,
  scheduleChangeRequestSchema,
  scheduleSwapCoworkerReviewSchema,
  scheduleSwapManagerReviewSchema,
  scheduleSwapRequestSchema,
} from "@/lib/validations/requests";

const REQUEST_LAYOUT_PATHS = [
  "/manager/requests",
  "/employee/requests",
  "/employee/day-off",
] as const;
const RELATED_LAYOUT_PATHS = [
  "/employee/leave",
  "/manager/deductions",
  "/manager/deductions/employee",
  "/employee/deductions",
  "/manager/attendance",
  "/manager/attendance/overrides",
  "/employee/attendance",
  "/employee/attendance/schedule",
] as const;
const CASH_ADVANCE_DEDUCTION_CODE = "CASH_ADVANCE";
const PAID_LEAVE_ALLOWANCE_PER_YEAR = 10;
const PAID_SICK_LEAVE_ALLOWANCE_PER_YEAR = 10;

const revalidateRequestLayouts = () => {
  REQUEST_LAYOUT_PATHS.forEach((path) => {
    revalidatePath(path, "layout");
  });
  RELATED_LAYOUT_PATHS.forEach((path) => {
    revalidatePath(path, "layout");
  });
};

const toIsoString = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

const toNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const canCreateEmployeeRequests = (role?: Roles) => role === Roles.Employee;

const canReviewRequests = (role?: Roles) =>
  role === Roles.Admin || role === Roles.Manager;

const enumerateZonedDaysInclusive = (start: Date, end: Date) => {
  const days: Date[] = [];
  let cursor = startOfZonedDay(start);
  const finalDay = startOfZonedDay(end);
  while (cursor.getTime() <= finalDay.getTime()) {
    days.push(cursor);
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return days;
};

const formatMinutesForDisplay = (minutes: number | null | undefined) => {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  const normalized = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(mins).padStart(2, "0")} ${suffix}`;
};

const formatShiftSnapshotLabel = (input: {
  shiftCode?: string | null;
  shiftName?: string | null;
  startMinutes?: number | null;
  endMinutes?: number | null;
}) => {
  if (!input.shiftCode && !input.shiftName) return "Rest day";
  const shiftLabel = input.shiftName || input.shiftCode || "Shift";
  const startLabel = formatMinutesForDisplay(input.startMinutes);
  const endLabel = formatMinutesForDisplay(input.endMinutes);
  const timeLabel =
    startLabel && endLabel ? `${startLabel} - ${endLabel}` : "No shift hours";
  return `${shiftLabel} (${timeLabel})`;
};

const shortDate = (value: Date) =>
  value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const toZonedDayKey = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });

type CashAdvanceRequestPayload = {
  amount: string | number;
  repaymentPerPayroll: string | number;
  preferredStartDate: string | Date;
  reason?: string | null;
};

type LeaveRequestPayload = {
  leaveType: LeaveRequestType | string;
  startDate: string | Date;
  endDate: string | Date;
  reason?: string | null;
};

type DayOffRequestPayload = {
  workDate: string | Date;
  reason?: string | null;
};

type ScheduleSwapRequestPayload = {
  coworkerEmployeeId: string;
  workDate: string | Date;
  reason?: string | null;
};

type ScheduleChangeRequestPayload = {
  workDate: string | Date;
  requestedShiftId: string | number;
  reason?: string | null;
};

type RequestReviewPayload = {
  id: string;
  decision: "APPROVED" | "REJECTED";
  managerRemarks?: string | null;
  paidDates?: Array<string | Date> | null;
};

type ScheduleSwapCoworkerReviewPayload = {
  id: string;
  decision: "ACCEPTED" | "DECLINED";
  coworkerRemarks?: string | null;
};

const employeeRequestSelect = {
  employeeId: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
} as const;

const reviewedBySelect = {
  userId: true,
  username: true,
} as const;

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

export type CashAdvanceRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  amount: number;
  repaymentPerPayroll: number;
  preferredStartDate: string;
  reason?: string | null;
  status: CashAdvanceRequestStatus;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  deductionAssignmentId?: string | null;
  linkedDeductionStatus?: EmployeeDeductionAssignmentStatus | null;
  linkedDeductionEffectiveFrom?: string | null;
  linkedDeductionRemainingBalance?: number | null;
};

export type LeaveRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  leaveType: LeaveRequestType;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: LeaveRequestStatus;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  totalDays: number;
  paidDaysCount: number;
  unpaidDaysCount: number;
  paidDateList: string[];
  unpaidDateList: string[];
};

export type EmployeeLeaveBalanceSummary = {
  year: number;
  paidLeaveAllowance: number;
  paidLeaveUsed: number;
  paidLeaveRemaining: number;
  paidSickLeaveAllowance: number;
  paidSickLeaveUsed: number;
  paidSickLeaveRemaining: number;
};

export type EmployeeDayOffMonthlySummary = {
  year: number;
  month: number;
  monthLabel: string;
  approvedThisMonth: number;
};

export type DayOffPreview = {
  workDate: string;
  employee: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
  };
  current: {
    shiftId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    shiftLabel: string;
  };
  resultLabel: string;
  wouldChange: boolean;
};

export type DayOffRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  workDate: string;
  currentShiftLabel: string;
  reason?: string | null;
  status: DayOffRequestStatus;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleChangeShiftOption = {
  id: number;
  code: string;
  name: string;
  shiftLabel: string;
};

export type ScheduleChangePreview = {
  workDate: string;
  employee: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
  };
  current: {
    shiftId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    shiftLabel: string;
  };
  requested: {
    shiftId: number;
    shiftCode: string;
    shiftName: string;
    shiftLabel: string;
  };
  wouldChange: boolean;
};

export type ScheduleChangeRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  workDate: string;
  currentShiftLabel: string;
  requestedShiftLabel: string;
  requestedShiftId: number;
  reason?: string | null;
  status: ScheduleChangeRequestStatus;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleSwapEmployeeOption = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
};

export type ScheduleSwapPreview = {
  workDate: string;
  requester: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    shiftId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    shiftLabel: string;
  };
  coworker: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    shiftId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    shiftLabel: string;
  };
  wouldChange: boolean;
};

export type ScheduleSwapRequestRow = {
  id: string;
  requesterEmployeeId: string;
  requesterEmployeeCode: string;
  requesterEmployeeName: string;
  coworkerEmployeeId: string;
  coworkerEmployeeCode: string;
  coworkerEmployeeName: string;
  workDate: string;
  requesterShiftLabel: string;
  coworkerShiftLabel: string;
  reason?: string | null;
  status: ScheduleSwapRequestStatus;
  coworkerRemarks?: string | null;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  coworkerRespondedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  isIncomingToViewer: boolean;
  isOutgoingFromViewer: boolean;
};

const toEmployeeName = (employee: {
  firstName: string;
  lastName: string;
}) =>
  [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();

type RequestDbClient = Prisma.TransactionClient | typeof db;

const leaveTypeToCurrentStatus = (
  leaveType: LeaveRequestType,
): CURRENT_STATUS => {
  switch (leaveType) {
    case LeaveRequestType.VACATION:
      return CURRENT_STATUS.VACATION;
    case LeaveRequestType.SICK:
      return CURRENT_STATUS.SICK_LEAVE;
    case LeaveRequestType.PERSONAL:
    case LeaveRequestType.EMERGENCY:
    case LeaveRequestType.UNPAID:
    default:
      return CURRENT_STATUS.ON_LEAVE;
  }
};

const syncEmployeeCurrentStatusFromApprovedLeave = async (
  client: RequestDbClient,
  employeeId: string,
  referenceDate = new Date(),
) => {
  const employee = await client.employee.findUnique({
    where: { employeeId },
    select: {
      currentStatus: true,
    },
  });

  if (!employee) return;
  if (
    employee.currentStatus === CURRENT_STATUS.INACTIVE ||
    employee.currentStatus === CURRENT_STATUS.ENDED
  ) {
    return;
  }

  const dayStart = startOfZonedDay(referenceDate);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

  const activeLeave = await client.leaveRequest.findFirst({
    where: {
      employeeId,
      status: LeaveRequestStatus.APPROVED,
      startDate: {
        lt: dayEnd,
      },
      endDate: {
        gte: dayStart,
      },
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: {
      leaveType: true,
    },
  });

  const nextStatus = activeLeave
    ? leaveTypeToCurrentStatus(activeLeave.leaveType)
    : CURRENT_STATUS.ACTIVE;

  if (employee.currentStatus !== nextStatus) {
    await client.employee.update({
      where: { employeeId },
      data: {
        currentStatus: nextStatus,
      },
    });
  }
};

const serializeCashAdvanceRequest = (
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

const serializeLeaveRequest = (row: LeaveRequestRecord): LeaveRequestRow => {
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

const serializeDayOffRequest = (row: DayOffRequestRecord): DayOffRequestRow => ({
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

const serializeScheduleChangeRequest = (
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

const serializeScheduleSwapRequest = (
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

const getEmployeeForSession = async (userId: string) =>
  db.employee.findUnique({
    where: { userId },
    select: {
      employeeId: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      isArchived: true,
      userId: true,
    },
  });

const scheduleSwapEmployeeSelect = {
  employeeId: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  isArchived: true,
  userId: true,
} as const;

const scheduleChangeShiftSelect = {
  id: true,
  code: true,
  name: true,
  startMinutes: true,
  endMinutes: true,
  spansMidnight: true,
  isActive: true,
} as const;

const toScheduleChangeShiftOption = (shift: {
  id: number;
  code: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
  spansMidnight: boolean;
}): ScheduleChangeShiftOption => ({
  id: shift.id,
  code: shift.code,
  name: shift.name,
  shiftLabel: formatShiftSnapshotLabel({
    shiftCode: shift.code,
    shiftName: shift.name,
    startMinutes: shift.startMinutes,
    endMinutes: shift.endMinutes,
  }),
});

const toScheduleSwapEmployeeOption = (employee: {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}) => ({
  employeeId: employee.employeeId,
  employeeCode: employee.employeeCode,
  employeeName: toEmployeeName(employee),
});

const toScheduleSnapshot = (expected: Awaited<ReturnType<typeof getExpectedShiftForDate>>) => ({
  shiftId: expected.shift?.id ?? null,
  shiftCode: expected.shift?.code ?? null,
  shiftName: expected.shift?.name ?? null,
  startMinutes: expected.shift?.startMinutes ?? null,
  endMinutes: expected.shift?.endMinutes ?? null,
  spansMidnight: expected.shift?.spansMidnight ?? false,
});

const buildScheduleChangePreview = async (
  employeeId: string,
  requestedShiftId: number,
  workDate: Date,
) => {
  const [employee, requestedShift] = await Promise.all([
    db.employee.findUnique({
      where: { employeeId },
      select: scheduleSwapEmployeeSelect,
    }),
    db.shift.findUnique({
      where: { id: requestedShiftId },
      select: scheduleChangeShiftSelect,
    }),
  ]);

  if (!employee || employee.isArchived) {
    return { error: "Employee record not found." } as const;
  }
  if (!requestedShift || !requestedShift.isActive) {
    return { error: "Requested shift is not available." } as const;
  }

  const expected = await getExpectedShiftForDate(employee.employeeId, workDate);
  const currentSnapshot = toScheduleSnapshot(expected);

  return {
    employee,
    requestedShift,
    currentSnapshot,
    preview: {
      workDate: workDate.toISOString(),
      employee: {
        employeeId: employee.employeeId,
        employeeCode: employee.employeeCode,
        employeeName: toEmployeeName(employee),
      },
      current: {
        shiftId: currentSnapshot.shiftId,
        shiftCode: currentSnapshot.shiftCode,
        shiftName: currentSnapshot.shiftName,
        shiftLabel: formatShiftSnapshotLabel(currentSnapshot),
      },
      requested: {
        shiftId: requestedShift.id,
        shiftCode: requestedShift.code,
        shiftName: requestedShift.name,
        shiftLabel: formatShiftSnapshotLabel({
          shiftCode: requestedShift.code,
          shiftName: requestedShift.name,
          startMinutes: requestedShift.startMinutes,
          endMinutes: requestedShift.endMinutes,
        }),
      },
      wouldChange: currentSnapshot.shiftId !== requestedShift.id,
    } satisfies ScheduleChangePreview,
  } as const;
};

const buildDayOffPreview = async (employeeId: string, workDate: Date) => {
  const employee = await db.employee.findUnique({
    where: { employeeId },
    select: scheduleSwapEmployeeSelect,
  });

  if (!employee || employee.isArchived) {
    return { error: "Employee record not found." } as const;
  }

  const expected = await getExpectedShiftForDate(employee.employeeId, workDate);
  const currentSnapshot = toScheduleSnapshot(expected);

  return {
    employee,
    currentSnapshot,
    preview: {
      workDate: workDate.toISOString(),
      employee: {
        employeeId: employee.employeeId,
        employeeCode: employee.employeeCode,
        employeeName: toEmployeeName(employee),
      },
      current: {
        shiftId: currentSnapshot.shiftId,
        shiftCode: currentSnapshot.shiftCode,
        shiftName: currentSnapshot.shiftName,
        shiftLabel: formatShiftSnapshotLabel(currentSnapshot),
      },
      resultLabel: "Day off (rest day)",
      wouldChange: currentSnapshot.shiftId !== null,
    } satisfies DayOffPreview,
  } as const;
};

const buildScheduleSwapPreview = async (
  requesterEmployeeId: string,
  coworkerEmployeeId: string,
  workDate: Date,
) => {
  const [requesterEmployee, coworkerEmployee] = await Promise.all([
    db.employee.findUnique({
      where: { employeeId: requesterEmployeeId },
      select: scheduleSwapEmployeeSelect,
    }),
    db.employee.findUnique({
      where: { employeeId: coworkerEmployeeId },
      select: scheduleSwapEmployeeSelect,
    }),
  ]);

  if (!requesterEmployee || requesterEmployee.isArchived) {
    return { error: "Requesting employee record not found." } as const;
  }
  if (!coworkerEmployee || coworkerEmployee.isArchived) {
    return { error: "Coworker record not found." } as const;
  }
  if (!coworkerEmployee.userId) {
    return {
      error:
        "The selected coworker cannot receive swap requests because they do not have a user account.",
    } as const;
  }

  const [requesterExpected, coworkerExpected] = await Promise.all([
    getExpectedShiftForDate(requesterEmployee.employeeId, workDate),
    getExpectedShiftForDate(coworkerEmployee.employeeId, workDate),
  ]);

  const requesterSnapshot = toScheduleSnapshot(requesterExpected);
  const coworkerSnapshot = toScheduleSnapshot(coworkerExpected);

  return {
    requesterEmployee,
    coworkerEmployee,
    requesterExpected,
    coworkerExpected,
    requesterSnapshot,
    coworkerSnapshot,
    preview: {
      workDate: workDate.toISOString(),
      requester: {
        employeeId: requesterEmployee.employeeId,
        employeeCode: requesterEmployee.employeeCode,
        employeeName: toEmployeeName(requesterEmployee),
        shiftId: requesterSnapshot.shiftId,
        shiftCode: requesterSnapshot.shiftCode,
        shiftName: requesterSnapshot.shiftName,
        shiftLabel: formatShiftSnapshotLabel(requesterSnapshot),
      },
      coworker: {
        employeeId: coworkerEmployee.employeeId,
        employeeCode: coworkerEmployee.employeeCode,
        employeeName: toEmployeeName(coworkerEmployee),
        shiftId: coworkerSnapshot.shiftId,
        shiftCode: coworkerSnapshot.shiftCode,
        shiftName: coworkerSnapshot.shiftName,
        shiftLabel: formatShiftSnapshotLabel(coworkerSnapshot),
      },
      wouldChange: requesterSnapshot.shiftId !== coworkerSnapshot.shiftId,
    } satisfies ScheduleSwapPreview,
  } as const;
};

const getScheduleSwapBlockingIssue = async (
  employeeId: string,
  workDate: Date,
  employeeLabel: string,
) => {
  const row = await db.attendance.findUnique({
    where: {
      employeeId_workDate: {
        employeeId,
        workDate,
      },
    },
    select: {
      status: true,
      isLocked: true,
      payrollPeriodId: true,
      actualInAt: true,
      actualOutAt: true,
      workedMinutes: true,
      netWorkedMinutes: true,
    },
  });

  if (!row) return null;
  if (row.payrollPeriodId) {
    return `${employeeLabel} already has payroll-linked attendance on ${shortDate(workDate)}.`;
  }
  if (row.isLocked) {
    return `${employeeLabel} already has locked attendance on ${shortDate(workDate)}.`;
  }
  if (row.status === ATTENDANCE_STATUS.LEAVE) {
    return `${employeeLabel} is already on leave on ${shortDate(workDate)}.`;
  }
  if (
    row.actualInAt ||
    row.actualOutAt ||
    Math.max(0, row.workedMinutes ?? 0) > 0 ||
    Math.max(0, row.netWorkedMinutes ?? 0) > 0
  ) {
    return `${employeeLabel} already has recorded work on ${shortDate(workDate)}.`;
  }
  return null;
};

export async function listCashAdvanceRequests(input?: {
  statuses?: CashAdvanceRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: CashAdvanceRequestRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 200;
    const limit = Math.max(1, Math.min(limitRaw, 500));
    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;

    const where: Prisma.CashAdvanceRequestWhereInput = {};

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      where.employeeId = employee.employeeId;
    } else if (canReviewRequests(session.role)) {
      if (employeeId) {
        where.employeeId = employeeId;
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to view cash advance requests.",
      };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const rows = await db.cashAdvanceRequest.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { submittedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
        deductionAssignment: {
          select: {
            id: true,
            status: true,
            effectiveFrom: true,
            remainingBalance: true,
          },
        },
      },
    });

    return { success: true, data: rows.map(serializeCashAdvanceRequest) };
  } catch (error) {
    console.error("Error listing cash advance requests:", error);
    return { success: false, error: "Failed to load cash advance requests." };
  }
}

export async function listLeaveRequests(input?: {
  statuses?: LeaveRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: LeaveRequestRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 200;
    const limit = Math.max(1, Math.min(limitRaw, 500));
    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;

    const where: Prisma.LeaveRequestWhereInput = {};

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      where.employeeId = employee.employeeId;
    } else if (canReviewRequests(session.role)) {
      if (employeeId) {
        where.employeeId = employeeId;
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to view leave requests.",
      };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const rows = await db.leaveRequest.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { submittedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
        attendances: {
          select: {
            workDate: true,
            isPaidLeave: true,
          },
        },
      },
    });

    return { success: true, data: rows.map(serializeLeaveRequest) };
  } catch (error) {
    console.error("Error listing leave requests:", error);
    return { success: false, error: "Failed to load leave requests." };
  }
}

export async function getEmployeeLeaveBalanceSummary(input?: {
  year?: number | null;
  employeeId?: string | null;
}): Promise<{
  success: boolean;
  data?: EmployeeLeaveBalanceSummary;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const resolvedYear =
      typeof input?.year === "number" && Number.isInteger(input.year)
        ? input.year
        : new Date().getFullYear();
    const year = Math.max(2000, Math.min(resolvedYear, 2100));

    let employeeId: string | null = null;

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }

      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      employeeId = employee.employeeId;
    } else if (canReviewRequests(session.role)) {
      employeeId =
        typeof input?.employeeId === "string" && input.employeeId.trim()
          ? input.employeeId.trim()
          : null;
      if (!employeeId) {
        return { success: false, error: "Employee is required." };
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to view leave balances.",
      };
    }

    const yearStart = new Date(`${year}-01-01T00:00:00+08:00`);
    const nextYearStart = new Date(`${year + 1}-01-01T00:00:00+08:00`);

    const paidLeaveAttendances = await db.attendance.findMany({
      where: {
        employeeId,
        status: ATTENDANCE_STATUS.LEAVE,
        isPaidLeave: true,
        workDate: {
          gte: yearStart,
          lt: nextYearStart,
        },
      },
      select: {
        leaveRequest: {
          select: {
            leaveType: true,
          },
        },
      },
    });

    let paidLeaveUsed = 0;
    let paidSickLeaveUsed = 0;

    paidLeaveAttendances.forEach((attendance) => {
      if (attendance.leaveRequest?.leaveType === LeaveRequestType.SICK) {
        paidSickLeaveUsed += 1;
      } else {
        paidLeaveUsed += 1;
      }
    });

    return {
      success: true,
      data: {
        year,
        paidLeaveAllowance: PAID_LEAVE_ALLOWANCE_PER_YEAR,
        paidLeaveUsed,
        paidLeaveRemaining: Math.max(
          0,
          PAID_LEAVE_ALLOWANCE_PER_YEAR - paidLeaveUsed,
        ),
        paidSickLeaveAllowance: PAID_SICK_LEAVE_ALLOWANCE_PER_YEAR,
        paidSickLeaveUsed,
        paidSickLeaveRemaining: Math.max(
          0,
          PAID_SICK_LEAVE_ALLOWANCE_PER_YEAR - paidSickLeaveUsed,
        ),
      },
    };
  } catch (error) {
    console.error("Error loading leave balance summary:", error);
    return { success: false, error: "Failed to load leave balances." };
  }
}

export async function getEmployeeDayOffMonthlySummary(input?: {
  year?: number | null;
  month?: number | null;
  employeeId?: string | null;
}): Promise<{
  success: boolean;
  data?: EmployeeDayOffMonthlySummary;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const todayKey = toZonedDayKey(new Date());
    const [currentYear, currentMonth] = todayKey.split("-").map(Number);
    const resolvedYear =
      typeof input?.year === "number" && Number.isInteger(input.year)
        ? input.year
        : currentYear;
    const resolvedMonth =
      typeof input?.month === "number" && Number.isInteger(input.month)
        ? input.month
        : currentMonth;
    const year = Math.max(2000, Math.min(resolvedYear, 2100));
    const month = Math.max(1, Math.min(resolvedMonth, 12));

    let employeeId: string | null = null;

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      employeeId = employee.employeeId;
    } else if (canReviewRequests(session.role)) {
      employeeId =
        typeof input?.employeeId === "string" && input.employeeId.trim()
          ? input.employeeId.trim()
          : null;
      if (!employeeId) {
        return { success: false, error: "Employee is required." };
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to view day off summaries.",
      };
    }

    const monthStart = new Date(
      `${year}-${String(month).padStart(2, "0")}-01T00:00:00+08:00`,
    );
    const nextMonthStart =
      month === 12
        ? new Date(`${year + 1}-01-01T00:00:00+08:00`)
        : new Date(
            `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00+08:00`,
          );

    const approvedThisMonth = await db.dayOffRequest.count({
      where: {
        employeeId,
        status: DayOffRequestStatus.APPROVED,
        workDate: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
    });

    return {
      success: true,
      data: {
        year,
        month,
        monthLabel: monthStart.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        approvedThisMonth,
      },
    };
  } catch (error) {
    console.error("Error loading day off monthly summary:", error);
    return { success: false, error: "Failed to load day off summary." };
  }
}

export async function getDayOffPreview(input: {
  workDate: string | Date;
}): Promise<{
  success: boolean;
  data?: DayOffPreview;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to preview day off requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = dayOffRequestSchema.safeParse({
      workDate: input.workDate,
      reason: undefined,
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid day off preview data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const workDate = startOfZonedDay(parsed.data.workDate!);
    const previewResult = await buildDayOffPreview(employee.employeeId, workDate);
    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }

    return { success: true, data: previewResult.preview };
  } catch (error) {
    console.error("Error loading day off preview:", error);
    return { success: false, error: "Failed to load day off preview." };
  }
}

export async function listDayOffRequests(input?: {
  statuses?: DayOffRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: DayOffRequestRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 200;
    const limit = Math.max(1, Math.min(limitRaw, 500));
    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;

    const where: Prisma.DayOffRequestWhereInput = {};

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      where.employeeId = employee.employeeId;
    } else if (canReviewRequests(session.role)) {
      if (employeeId) {
        where.employeeId = employeeId;
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to view day off requests.",
      };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const rows = await db.dayOffRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    return { success: true, data: rows.map(serializeDayOffRequest) };
  } catch (error) {
    console.error("Error listing day off requests:", error);
    return { success: false, error: "Failed to load day off requests." };
  }
}

export async function listEmployeesForScheduleSwap(input?: {
  query?: string | null;
  workDate?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: ScheduleSwapEmployeeOption[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to search coworkers for swap requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 50;
    const limit = Math.max(1, Math.min(limitRaw, 100));
    const query =
      typeof input?.query === "string" ? input.query.trim() : "";

    const rows = await db.employee.findMany({
      where: {
        isArchived: false,
        employeeId: { not: employee.employeeId },
        userId: { not: null },
        ...(query
          ? {
              OR: [
                { employeeCode: { contains: query, mode: "insensitive" } },
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: limit,
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
      },
    });

    return {
      success: true,
      data: rows.map(toScheduleSwapEmployeeOption),
    };
  } catch (error) {
    console.error("Error listing coworkers for schedule swap:", error);
    return { success: false, error: "Failed to load coworkers." };
  }
}

export async function getScheduleSwapPreview(input: {
  coworkerEmployeeId: string;
  workDate: string | Date;
}): Promise<{
  success: boolean;
  data?: ScheduleSwapPreview;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to preview swap requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = scheduleSwapRequestSchema.safeParse({
      coworkerEmployeeId: input.coworkerEmployeeId,
      workDate: input.workDate,
      reason: undefined,
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid swap preview data.",
      };
    }

    const requester = await getEmployeeForSession(session.userId);
    if (!requester || requester.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const workDate = startOfZonedDay(parsed.data.workDate!);
    const previewResult = await buildScheduleSwapPreview(
      requester.employeeId,
      parsed.data.coworkerEmployeeId,
      workDate,
    );

    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }

    if (!previewResult.preview.wouldChange) {
      return {
        success: false,
        error:
          "Both employees already have the same schedule on that date, so there is nothing to swap.",
      };
    }

    return { success: true, data: previewResult.preview };
  } catch (error) {
    console.error("Error loading schedule swap preview:", error);
    return { success: false, error: "Failed to load schedule swap preview." };
  }
}

export async function listScheduleChangeShifts(input?: {
  query?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: ScheduleChangeShiftOption[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to view schedule change shifts.",
      };
    }

    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 50;
    const limit = Math.max(1, Math.min(limitRaw, 200));
    const query =
      typeof input?.query === "string" && input.query.trim()
        ? input.query.trim()
        : null;

    const rows = await db.shift.findMany({
      where: {
        isActive: true,
        ...(query
          ? {
              OR: [
                { code: { contains: query, mode: "insensitive" } },
                { name: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: "asc" }, { code: "asc" }],
      take: limit,
      select: scheduleChangeShiftSelect,
    });

    return {
      success: true,
      data: rows.map(toScheduleChangeShiftOption),
    };
  } catch (error) {
    console.error("Error listing schedule change shifts:", error);
    return { success: false, error: "Failed to load shifts." };
  }
}

export async function getScheduleChangePreview(input: {
  requestedShiftId: string | number;
  workDate: string | Date;
}): Promise<{
  success: boolean;
  data?: ScheduleChangePreview;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to preview schedule changes.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = scheduleChangeRequestSchema.safeParse({
      ...input,
      reason: undefined,
    });
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message || "Invalid schedule change preview data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const workDate = startOfZonedDay(parsed.data.workDate!);
    const previewResult = await buildScheduleChangePreview(
      employee.employeeId,
      parsed.data.requestedShiftId!,
      workDate,
    );

    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }

    return {
      success: true,
      data: previewResult.preview,
    };
  } catch (error) {
    console.error("Error loading schedule change preview:", error);
    return { success: false, error: "Failed to load schedule change preview." };
  }
}

export async function listScheduleChangeRequests(input?: {
  statuses?: ScheduleChangeRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: ScheduleChangeRequestRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 200;
    const limit = Math.max(1, Math.min(limitRaw, 500));
    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;

    const where: Prisma.ScheduleChangeRequestWhereInput = {};

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      where.employeeId = employee.employeeId;
    } else if (canReviewRequests(session.role)) {
      if (employeeId) {
        where.employeeId = employeeId;
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to view schedule change requests.",
      };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const rows = await db.scheduleChangeRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    return {
      success: true,
      data: rows.map(serializeScheduleChangeRequest),
    };
  } catch (error) {
    console.error("Error listing schedule change requests:", error);
    return {
      success: false,
      error: "Failed to load schedule change requests.",
    };
  }
}

export async function listScheduleSwapRequests(input?: {
  statuses?: ScheduleSwapRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: ScheduleSwapRequestRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 200;
    const limit = Math.max(1, Math.min(limitRaw, 500));
    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;

    const where: Prisma.ScheduleSwapRequestWhereInput = {};
    let viewerEmployeeId: string | null = null;

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      viewerEmployeeId = employee.employeeId;
      where.OR = [
        { requesterEmployeeId: employee.employeeId },
        { coworkerEmployeeId: employee.employeeId },
      ];
    } else if (canReviewRequests(session.role)) {
      if (employeeId) {
        where.OR = [
          { requesterEmployeeId: employeeId },
          { coworkerEmployeeId: employeeId },
        ];
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to view schedule swap requests.",
      };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const rows = await db.scheduleSwapRequest.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { submittedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
      include: {
        requesterEmployee: { select: employeeRequestSelect },
        coworkerEmployee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    return {
      success: true,
      data: rows.map((row) =>
        serializeScheduleSwapRequest(row, viewerEmployeeId),
      ),
    };
  } catch (error) {
    console.error("Error listing schedule swap requests:", error);
    return { success: false, error: "Failed to load schedule swap requests." };
  }
}

export async function createCashAdvanceRequest(
  input: CashAdvanceRequestPayload,
): Promise<{
  success: boolean;
  data?: CashAdvanceRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create cash advance requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = cashAdvanceRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid request data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const created = await db.cashAdvanceRequest.create({
      data: {
        employeeId: employee.employeeId,
        amount: roundMoney(parsed.data.amount!),
        repaymentPerPayroll: roundMoney(parsed.data.repaymentPerPayroll!),
        preferredStartDate: parsed.data.preferredStartDate!,
        reason: parsed.data.reason ?? null,
        status: CashAdvanceRequestStatus.PENDING_MANAGER,
      },
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
        deductionAssignment: {
          select: {
            id: true,
            status: true,
            effectiveFrom: true,
            remainingBalance: true,
          },
        },
      },
    });

    revalidateRequestLayouts();
    return { success: true, data: serializeCashAdvanceRequest(created) };
  } catch (error) {
    console.error("Error creating cash advance request:", error);
    return { success: false, error: "Failed to create cash advance request." };
  }
}

export async function createLeaveRequest(
  input: LeaveRequestPayload,
): Promise<{
  success: boolean;
  data?: LeaveRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create leave requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = leaveRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid leave request data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const overlapping = await db.leaveRequest.findFirst({
      where: {
        employeeId: employee.employeeId,
        status: {
          in: [LeaveRequestStatus.PENDING_MANAGER, LeaveRequestStatus.APPROVED],
        },
        startDate: {
          lte: parsed.data.endDate!,
        },
        endDate: {
          gte: parsed.data.startDate!,
        },
      },
      select: { id: true },
    });

    if (overlapping) {
      return {
        success: false,
        error:
          "There is already a pending or approved leave request overlapping these dates.",
      };
    }

    const created = await db.leaveRequest.create({
      data: {
        employeeId: employee.employeeId,
        leaveType: parsed.data.leaveType,
        startDate: parsed.data.startDate!,
        endDate: parsed.data.endDate!,
        reason: parsed.data.reason ?? null,
        status: LeaveRequestStatus.PENDING_MANAGER,
      },
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
        attendances: {
          select: {
            workDate: true,
            isPaidLeave: true,
          },
        },
      },
    });

    revalidateRequestLayouts();
    return { success: true, data: serializeLeaveRequest(created) };
  } catch (error) {
    console.error("Error creating leave request:", error);
    return { success: false, error: "Failed to create leave request." };
  }
}

export async function createDayOffRequest(
  input: DayOffRequestPayload,
): Promise<{
  success: boolean;
  data?: DayOffRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create day off requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = dayOffRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid day off request data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const workDate = startOfZonedDay(parsed.data.workDate!);
    const today = startOfZonedDay(new Date());
    if (workDate.getTime() < today.getTime()) {
      return {
        success: false,
        error: "Day off requests can only be submitted for today or future dates.",
      };
    }

    const previewResult = await buildDayOffPreview(employee.employeeId, workDate);
    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }
    if (!previewResult.preview.wouldChange) {
      return {
        success: false,
        error: "You are already not scheduled to work on that date.",
      };
    }

    const [blockingIssue, duplicate, changeConflict, swapConflict] =
      await Promise.all([
        getScheduleSwapBlockingIssue(
          employee.employeeId,
          workDate,
          previewResult.preview.employee.employeeName,
        ),
        db.dayOffRequest.findFirst({
          where: {
            employeeId: employee.employeeId,
            workDate,
            status: {
              in: [DayOffRequestStatus.PENDING_MANAGER, DayOffRequestStatus.APPROVED],
            },
          },
          select: { id: true },
        }),
        db.scheduleChangeRequest.findFirst({
          where: {
            employeeId: employee.employeeId,
            workDate,
            status: {
              in: [
                ScheduleChangeRequestStatus.PENDING_MANAGER,
                ScheduleChangeRequestStatus.APPROVED,
              ],
            },
          },
          select: { id: true },
        }),
        db.scheduleSwapRequest.findFirst({
          where: {
            workDate,
            status: {
              in: [
                ScheduleSwapRequestStatus.PENDING_COWORKER,
                ScheduleSwapRequestStatus.PENDING_MANAGER,
                ScheduleSwapRequestStatus.APPROVED,
              ],
            },
            OR: [
              { requesterEmployeeId: employee.employeeId },
              { coworkerEmployeeId: employee.employeeId },
            ],
          },
          select: { id: true },
        }),
      ]);

    if (blockingIssue) {
      return { success: false, error: blockingIssue };
    }
    if (duplicate) {
      return {
        success: false,
        error: "There is already an active day off request for that date.",
      };
    }
    if (changeConflict) {
      return {
        success: false,
        error:
          "There is already an active schedule change request for that date.",
      };
    }
    if (swapConflict) {
      return {
        success: false,
        error:
          "There is already an active schedule swap request involving you on that date.",
      };
    }

    const created = await db.dayOffRequest.create({
      data: {
        employeeId: employee.employeeId,
        workDate,
        currentShiftIdSnapshot: previewResult.currentSnapshot.shiftId,
        currentShiftCodeSnapshot: previewResult.currentSnapshot.shiftCode,
        currentShiftNameSnapshot: previewResult.currentSnapshot.shiftName,
        currentStartMinutesSnapshot: previewResult.currentSnapshot.startMinutes,
        currentEndMinutesSnapshot: previewResult.currentSnapshot.endMinutes,
        currentSpansMidnightSnapshot:
          previewResult.currentSnapshot.spansMidnight,
        reason: parsed.data.reason ?? null,
        status: DayOffRequestStatus.PENDING_MANAGER,
      },
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    revalidateRequestLayouts();
    return { success: true, data: serializeDayOffRequest(created) };
  } catch (error) {
    console.error("Error creating day off request:", error);
    return { success: false, error: "Failed to create day off request." };
  }
}

export async function createScheduleChangeRequest(
  input: ScheduleChangeRequestPayload,
): Promise<{
  success: boolean;
  data?: ScheduleChangeRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create schedule change requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = scheduleChangeRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message || "Invalid schedule change data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const workDate = startOfZonedDay(parsed.data.workDate!);
    const today = startOfZonedDay(new Date());
    if (workDate.getTime() < today.getTime()) {
      return {
        success: false,
        error: "Schedule changes can only be requested for today or future dates.",
      };
    }

    const previewResult = await buildScheduleChangePreview(
      employee.employeeId,
      parsed.data.requestedShiftId!,
      workDate,
    );

    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }
    if (!previewResult.preview.wouldChange) {
      return {
        success: false,
        error:
          "Your requested shift is already assigned on that date, so there is nothing to change.",
      };
    }

    const [blockingIssue, duplicate, dayOffConflict, swapConflict] =
      await Promise.all([
      getScheduleSwapBlockingIssue(
        employee.employeeId,
        workDate,
        previewResult.preview.employee.employeeName,
      ),
      db.scheduleChangeRequest.findFirst({
        where: {
          employeeId: employee.employeeId,
          workDate,
          status: {
            in: [
              ScheduleChangeRequestStatus.PENDING_MANAGER,
              ScheduleChangeRequestStatus.APPROVED,
            ],
          },
        },
        select: { id: true },
        }),
        db.dayOffRequest.findFirst({
          where: {
            employeeId: employee.employeeId,
            workDate,
            status: {
              in: [DayOffRequestStatus.PENDING_MANAGER, DayOffRequestStatus.APPROVED],
            },
          },
          select: { id: true },
        }),
        db.scheduleSwapRequest.findFirst({
          where: {
            workDate,
          status: {
            in: [
              ScheduleSwapRequestStatus.PENDING_COWORKER,
              ScheduleSwapRequestStatus.PENDING_MANAGER,
              ScheduleSwapRequestStatus.APPROVED,
            ],
          },
          OR: [
            { requesterEmployeeId: employee.employeeId },
            { coworkerEmployeeId: employee.employeeId },
          ],
        },
        select: { id: true },
        }),
      ]);

    if (blockingIssue) {
      return { success: false, error: blockingIssue };
    }
    if (duplicate) {
      return {
        success: false,
        error:
          "There is already an active schedule change request for that date.",
      };
    }
    if (dayOffConflict) {
      return {
        success: false,
        error: "There is already an active day off request for that date.",
      };
    }
    if (swapConflict) {
      return {
        success: false,
        error:
          "There is already an active schedule swap request involving you on that date.",
      };
    }

    const created = await db.scheduleChangeRequest.create({
      data: {
        employeeId: employee.employeeId,
        workDate,
        currentShiftIdSnapshot: previewResult.currentSnapshot.shiftId,
        currentShiftCodeSnapshot: previewResult.currentSnapshot.shiftCode,
        currentShiftNameSnapshot: previewResult.currentSnapshot.shiftName,
        currentStartMinutesSnapshot: previewResult.currentSnapshot.startMinutes,
        currentEndMinutesSnapshot: previewResult.currentSnapshot.endMinutes,
        currentSpansMidnightSnapshot:
          previewResult.currentSnapshot.spansMidnight,
        requestedShiftId: previewResult.requestedShift.id,
        requestedShiftCodeSnapshot: previewResult.requestedShift.code,
        requestedShiftNameSnapshot: previewResult.requestedShift.name,
        requestedStartMinutesSnapshot: previewResult.requestedShift.startMinutes,
        requestedEndMinutesSnapshot: previewResult.requestedShift.endMinutes,
        requestedSpansMidnightSnapshot:
          previewResult.requestedShift.spansMidnight,
        reason: parsed.data.reason ?? null,
        status: ScheduleChangeRequestStatus.PENDING_MANAGER,
      },
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    revalidateRequestLayouts();
    return { success: true, data: serializeScheduleChangeRequest(created) };
  } catch (error) {
    console.error("Error creating schedule change request:", error);
    return {
      success: false,
      error: "Failed to create schedule change request.",
    };
  }
}

export async function createScheduleSwapRequest(
  input: ScheduleSwapRequestPayload,
): Promise<{
  success: boolean;
  data?: ScheduleSwapRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create schedule swap requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = scheduleSwapRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid schedule swap data.",
      };
    }

    const requester = await getEmployeeForSession(session.userId);
    if (!requester || requester.isArchived) {
      return { success: false, error: "Employee record not found." };
    }
    if (requester.employeeId === parsed.data.coworkerEmployeeId) {
      return {
        success: false,
        error: "You cannot request a schedule swap with yourself.",
      };
    }

    const workDate = startOfZonedDay(parsed.data.workDate!);
    const today = startOfZonedDay(new Date());
    if (workDate.getTime() < today.getTime()) {
      return {
        success: false,
        error: "Schedule swaps can only be requested for today or future dates.",
      };
    }

    const previewResult = await buildScheduleSwapPreview(
      requester.employeeId,
      parsed.data.coworkerEmployeeId,
      workDate,
    );

    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }
    if (!previewResult.preview.wouldChange) {
      return {
        success: false,
        error:
          "Both employees already have the same schedule on that date, so there is nothing to swap.",
      };
    }

    const [requesterIssue, coworkerIssue, duplicate, requesterDayOff, coworkerDayOff] =
      await Promise.all([
      getScheduleSwapBlockingIssue(
        previewResult.requesterEmployee.employeeId,
        workDate,
        previewResult.preview.requester.employeeName,
      ),
      getScheduleSwapBlockingIssue(
        previewResult.coworkerEmployee.employeeId,
        workDate,
        previewResult.preview.coworker.employeeName,
      ),
      db.scheduleSwapRequest.findFirst({
        where: {
          workDate,
          status: {
            in: [
              ScheduleSwapRequestStatus.PENDING_COWORKER,
              ScheduleSwapRequestStatus.PENDING_MANAGER,
            ],
          },
          OR: [
            {
              requesterEmployeeId: previewResult.requesterEmployee.employeeId,
              coworkerEmployeeId: previewResult.coworkerEmployee.employeeId,
            },
            {
              requesterEmployeeId: previewResult.coworkerEmployee.employeeId,
              coworkerEmployeeId: previewResult.requesterEmployee.employeeId,
            },
          ],
        },
        select: { id: true },
      }),
      db.dayOffRequest.findFirst({
        where: {
          employeeId: previewResult.requesterEmployee.employeeId,
          workDate,
          status: {
            in: [DayOffRequestStatus.PENDING_MANAGER, DayOffRequestStatus.APPROVED],
          },
        },
        select: { id: true },
      }),
      db.dayOffRequest.findFirst({
        where: {
          employeeId: previewResult.coworkerEmployee.employeeId,
          workDate,
          status: {
            in: [DayOffRequestStatus.PENDING_MANAGER, DayOffRequestStatus.APPROVED],
          },
        },
        select: { id: true },
      }),
    ]);

    if (requesterIssue) {
      return { success: false, error: requesterIssue };
    }
    if (coworkerIssue) {
      return { success: false, error: coworkerIssue };
    }
    if (duplicate) {
      return {
        success: false,
        error:
          "There is already an active schedule swap request between these employees on that date.",
      };
    }
    if (requesterDayOff) {
      return {
        success: false,
        error:
          "You already have an active day off request on that date.",
      };
    }
    if (coworkerDayOff) {
      return {
        success: false,
        error:
          "The selected coworker already has an active day off request on that date.",
      };
    }

    const created = await db.scheduleSwapRequest.create({
      data: {
        requesterEmployeeId: previewResult.requesterEmployee.employeeId,
        coworkerEmployeeId: previewResult.coworkerEmployee.employeeId,
        workDate,
        requesterShiftIdSnapshot: previewResult.requesterSnapshot.shiftId,
        requesterShiftCodeSnapshot: previewResult.requesterSnapshot.shiftCode,
        requesterShiftNameSnapshot: previewResult.requesterSnapshot.shiftName,
        requesterStartMinutesSnapshot: previewResult.requesterSnapshot.startMinutes,
        requesterEndMinutesSnapshot: previewResult.requesterSnapshot.endMinutes,
        requesterSpansMidnightSnapshot:
          previewResult.requesterSnapshot.spansMidnight,
        coworkerShiftIdSnapshot: previewResult.coworkerSnapshot.shiftId,
        coworkerShiftCodeSnapshot: previewResult.coworkerSnapshot.shiftCode,
        coworkerShiftNameSnapshot: previewResult.coworkerSnapshot.shiftName,
        coworkerStartMinutesSnapshot: previewResult.coworkerSnapshot.startMinutes,
        coworkerEndMinutesSnapshot: previewResult.coworkerSnapshot.endMinutes,
        coworkerSpansMidnightSnapshot:
          previewResult.coworkerSnapshot.spansMidnight,
        reason: parsed.data.reason ?? null,
        status: ScheduleSwapRequestStatus.PENDING_COWORKER,
      },
      include: {
        requesterEmployee: { select: employeeRequestSelect },
        coworkerEmployee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    revalidateRequestLayouts();
    return {
      success: true,
      data: serializeScheduleSwapRequest(created, requester.employeeId),
    };
  } catch (error) {
    console.error("Error creating schedule swap request:", error);
    return { success: false, error: "Failed to create schedule swap request." };
  }
}

export async function respondToScheduleSwapRequest(
  input: ScheduleSwapCoworkerReviewPayload,
): Promise<{
  success: boolean;
  data?: ScheduleSwapRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to respond to schedule swap requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = scheduleSwapCoworkerReviewSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid swap response data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const existing = await db.scheduleSwapRequest.findUnique({
      where: { id: parsed.data.id },
      include: {
        requesterEmployee: { select: employeeRequestSelect },
        coworkerEmployee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    if (!existing) {
      return { success: false, error: "Schedule swap request not found." };
    }
    if (existing.coworkerEmployeeId !== employee.employeeId) {
      return {
        success: false,
        error: "Only the selected coworker can respond to this swap request.",
      };
    }
    if (existing.status !== ScheduleSwapRequestStatus.PENDING_COWORKER) {
      return {
        success: false,
        error: "This schedule swap request is no longer waiting for coworker response.",
      };
    }

    const updated = await db.scheduleSwapRequest.update({
      where: { id: parsed.data.id },
      data: {
        status:
          parsed.data.decision === "ACCEPTED"
            ? ScheduleSwapRequestStatus.PENDING_MANAGER
            : ScheduleSwapRequestStatus.DECLINED,
        coworkerRemarks: parsed.data.coworkerRemarks ?? null,
        coworkerRespondedAt: new Date(),
      },
      include: {
        requesterEmployee: { select: employeeRequestSelect },
        coworkerEmployee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    revalidateRequestLayouts();
    return {
      success: true,
      data: serializeScheduleSwapRequest(updated, employee.employeeId),
    };
  } catch (error) {
    console.error("Error responding to schedule swap request:", error);
    return {
      success: false,
      error: "Failed to respond to the schedule swap request.",
    };
  }
}

export async function reviewScheduleSwapRequest(
  input: RequestReviewPayload,
): Promise<{
  success: boolean;
  data?: ScheduleSwapRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to review schedule swap requests.",
      };
    }

    const parsed = scheduleSwapManagerReviewSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid review data.",
      };
    }

    const existing = await db.scheduleSwapRequest.findUnique({
      where: { id: parsed.data.id },
      include: {
        requesterEmployee: { select: scheduleSwapEmployeeSelect },
        coworkerEmployee: { select: scheduleSwapEmployeeSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    if (!existing) {
      return { success: false, error: "Schedule swap request not found." };
    }
    if (existing.requesterEmployee.isArchived || existing.coworkerEmployee.isArchived) {
      return {
        success: false,
        error: "One of the employees linked to this request is archived.",
      };
    }
    if (existing.status !== ScheduleSwapRequestStatus.PENDING_MANAGER) {
      return {
        success: false,
        error: "Only coworker-approved swap requests can be reviewed.",
      };
    }

    const reviewedAt = new Date();

    if (parsed.data.decision === "REJECTED") {
      const reviewed = await db.scheduleSwapRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: ScheduleSwapRequestStatus.REJECTED,
          managerRemarks: parsed.data.managerRemarks ?? null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt,
        },
        include: {
          requesterEmployee: { select: employeeRequestSelect },
          coworkerEmployee: { select: employeeRequestSelect },
          reviewedBy: { select: reviewedBySelect },
        },
      });

      revalidateRequestLayouts();
      return { success: true, data: serializeScheduleSwapRequest(reviewed) };
    }

    const workDate = startOfZonedDay(existing.workDate);
    const previewResult = await buildScheduleSwapPreview(
      existing.requesterEmployeeId,
      existing.coworkerEmployeeId,
      workDate,
    );

    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }
    if (!previewResult.preview.wouldChange) {
      return {
        success: false,
        error:
          "The schedules no longer differ on that date, so the swap request is no longer applicable.",
      };
    }

    if (
      previewResult.requesterSnapshot.shiftId !== existing.requesterShiftIdSnapshot ||
      previewResult.coworkerSnapshot.shiftId !== existing.coworkerShiftIdSnapshot
    ) {
      return {
        success: false,
        error:
          "One of the schedules changed after the request was submitted. Ask the employee to submit a new swap request.",
      };
    }

    const requesterIssue = await getScheduleSwapBlockingIssue(
      existing.requesterEmployeeId,
      workDate,
      toEmployeeName(existing.requesterEmployee),
    );
    if (requesterIssue) {
      return { success: false, error: requesterIssue };
    }
    const coworkerIssue = await getScheduleSwapBlockingIssue(
      existing.coworkerEmployeeId,
      workDate,
      toEmployeeName(existing.coworkerEmployee),
    );
    if (coworkerIssue) {
      return { success: false, error: coworkerIssue };
    }

    const reviewed = await db.$transaction(async (tx) => {
      await tx.employeeShiftOverride.upsert({
        where: {
          employeeId_workDate: {
            employeeId: existing.requesterEmployeeId,
            workDate,
          },
        },
        update: {
          shiftId: existing.coworkerShiftIdSnapshot,
          source: "APPROVED_REQUEST",
          note: `Schedule swap approved from request ${existing.id}`,
        },
        create: {
          employeeId: existing.requesterEmployeeId,
          workDate,
          shiftId: existing.coworkerShiftIdSnapshot,
          source: "APPROVED_REQUEST",
          note: `Schedule swap approved from request ${existing.id}`,
        },
      });

      await tx.employeeShiftOverride.upsert({
        where: {
          employeeId_workDate: {
            employeeId: existing.coworkerEmployeeId,
            workDate,
          },
        },
        update: {
          shiftId: existing.requesterShiftIdSnapshot,
          source: "APPROVED_REQUEST",
          note: `Schedule swap approved from request ${existing.id}`,
        },
        create: {
          employeeId: existing.coworkerEmployeeId,
          workDate,
          shiftId: existing.requesterShiftIdSnapshot,
          source: "APPROVED_REQUEST",
          note: `Schedule swap approved from request ${existing.id}`,
        },
      });

      const existingRequesterAttendance = await tx.attendance.findUnique({
        where: {
          employeeId_workDate: {
            employeeId: existing.requesterEmployeeId,
            workDate,
          },
        },
        select: { id: true },
      });
      if (existingRequesterAttendance) {
        await tx.attendance.update({
          where: { id: existingRequesterAttendance.id },
          data: {
            expectedShiftId: existing.coworkerShiftIdSnapshot,
            scheduledStartMinutes: existing.coworkerStartMinutesSnapshot,
            scheduledEndMinutes: existing.coworkerEndMinutesSnapshot,
          },
        });
      }

      const existingCoworkerAttendance = await tx.attendance.findUnique({
        where: {
          employeeId_workDate: {
            employeeId: existing.coworkerEmployeeId,
            workDate,
          },
        },
        select: { id: true },
      });
      if (existingCoworkerAttendance) {
        await tx.attendance.update({
          where: { id: existingCoworkerAttendance.id },
          data: {
            expectedShiftId: existing.requesterShiftIdSnapshot,
            scheduledStartMinutes: existing.requesterStartMinutesSnapshot,
            scheduledEndMinutes: existing.requesterEndMinutesSnapshot,
          },
        });
      }

      return tx.scheduleSwapRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: ScheduleSwapRequestStatus.APPROVED,
          managerRemarks: parsed.data.managerRemarks ?? null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt,
        },
        include: {
          requesterEmployee: { select: employeeRequestSelect },
          coworkerEmployee: { select: employeeRequestSelect },
          reviewedBy: { select: reviewedBySelect },
        },
      });
    });

    revalidateRequestLayouts();
    return { success: true, data: serializeScheduleSwapRequest(reviewed) };
  } catch (error) {
    console.error("Error reviewing schedule swap request:", error);
    return { success: false, error: "Failed to review schedule swap request." };
  }
}

export async function reviewDayOffRequest(
  input: RequestReviewPayload,
): Promise<{
  success: boolean;
  data?: DayOffRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to review day off requests.",
      };
    }

    const parsed = cashAdvanceReviewSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid review data.",
      };
    }

    const existing = await db.dayOffRequest.findUnique({
      where: { id: parsed.data.id },
      include: {
        employee: { select: scheduleSwapEmployeeSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    if (!existing) {
      return { success: false, error: "Day off request not found." };
    }
    if (existing.employee.isArchived) {
      return {
        success: false,
        error: "The employee linked to this request is archived.",
      };
    }
    if (existing.status !== DayOffRequestStatus.PENDING_MANAGER) {
      return {
        success: false,
        error: "Only pending day off requests can be reviewed.",
      };
    }

    const reviewedAt = new Date();

    if (parsed.data.decision === "REJECTED") {
      const reviewed = await db.dayOffRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: DayOffRequestStatus.REJECTED,
          managerRemarks: parsed.data.managerRemarks ?? null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt,
        },
        include: {
          employee: { select: employeeRequestSelect },
          reviewedBy: { select: reviewedBySelect },
        },
      });

      revalidateRequestLayouts();
      return { success: true, data: serializeDayOffRequest(reviewed) };
    }

    const workDate = startOfZonedDay(existing.workDate);
    const previewResult = await buildDayOffPreview(existing.employeeId, workDate);
    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }
    if (!previewResult.preview.wouldChange) {
      return {
        success: false,
        error: "The employee is already not scheduled to work on that date.",
      };
    }
    if (previewResult.currentSnapshot.shiftId !== existing.currentShiftIdSnapshot) {
      return {
        success: false,
        error:
          "The employee's schedule changed after the request was submitted. Ask them to submit a new day off request.",
      };
    }

    const blockingIssue = await getScheduleSwapBlockingIssue(
      existing.employeeId,
      workDate,
      toEmployeeName(existing.employee),
    );
    if (blockingIssue) {
      return { success: false, error: blockingIssue };
    }

    const reviewed = await db.$transaction(async (tx) => {
      await tx.employeeShiftOverride.upsert({
        where: {
          employeeId_workDate: {
            employeeId: existing.employeeId,
            workDate,
          },
        },
        update: {
          shiftId: null,
          source: "APPROVED_REQUEST",
          note: `Day off approved from request ${existing.id}`,
        },
        create: {
          employeeId: existing.employeeId,
          workDate,
          shiftId: null,
          source: "APPROVED_REQUEST",
          note: `Day off approved from request ${existing.id}`,
        },
      });

      const existingAttendance = await tx.attendance.findUnique({
        where: {
          employeeId_workDate: {
            employeeId: existing.employeeId,
            workDate,
          },
        },
        select: { id: true },
      });

      if (existingAttendance) {
        await tx.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            status: ATTENDANCE_STATUS.REST,
            isPaidLeave: false,
            leaveRequestId: null,
            expectedShiftId: null,
            scheduledStartMinutes: null,
            scheduledEndMinutes: null,
            paidHoursPerDay: null,
          },
        });
      }

      return tx.dayOffRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: DayOffRequestStatus.APPROVED,
          managerRemarks: parsed.data.managerRemarks ?? null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt,
        },
        include: {
          employee: { select: employeeRequestSelect },
          reviewedBy: { select: reviewedBySelect },
        },
      });
    });

    revalidateRequestLayouts();
    return { success: true, data: serializeDayOffRequest(reviewed) };
  } catch (error) {
    console.error("Error reviewing day off request:", error);
    return { success: false, error: "Failed to review day off request." };
  }
}

export async function reviewScheduleChangeRequest(
  input: RequestReviewPayload,
): Promise<{
  success: boolean;
  data?: ScheduleChangeRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to review schedule change requests.",
      };
    }

    const parsed = cashAdvanceReviewSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid review data.",
      };
    }

    const existing = await db.scheduleChangeRequest.findUnique({
      where: { id: parsed.data.id },
      include: {
        employee: { select: scheduleSwapEmployeeSelect },
        reviewedBy: { select: reviewedBySelect },
      },
    });

    if (!existing) {
      return { success: false, error: "Schedule change request not found." };
    }
    if (existing.employee.isArchived) {
      return {
        success: false,
        error: "The employee linked to this request is archived.",
      };
    }
    if (existing.status !== ScheduleChangeRequestStatus.PENDING_MANAGER) {
      return {
        success: false,
        error: "Only pending schedule change requests can be reviewed.",
      };
    }

    const reviewedAt = new Date();

    if (parsed.data.decision === "REJECTED") {
      const reviewed = await db.scheduleChangeRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: ScheduleChangeRequestStatus.REJECTED,
          managerRemarks: parsed.data.managerRemarks ?? null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt,
        },
        include: {
          employee: { select: employeeRequestSelect },
          reviewedBy: { select: reviewedBySelect },
        },
      });

      revalidateRequestLayouts();
      return { success: true, data: serializeScheduleChangeRequest(reviewed) };
    }

    const workDate = startOfZonedDay(existing.workDate);
    const previewResult = await buildScheduleChangePreview(
      existing.employeeId,
      existing.requestedShiftId,
      workDate,
    );

    if ("error" in previewResult) {
      return { success: false, error: previewResult.error };
    }
    if (!previewResult.preview.wouldChange) {
      return {
        success: false,
        error:
          "The employee is already assigned to that shift on the requested date.",
      };
    }
    if (previewResult.currentSnapshot.shiftId !== existing.currentShiftIdSnapshot) {
      return {
        success: false,
        error:
          "The employee's schedule changed after the request was submitted. Ask them to submit a new schedule change request.",
      };
    }

    const blockingIssue = await getScheduleSwapBlockingIssue(
      existing.employeeId,
      workDate,
      toEmployeeName(existing.employee),
    );
    if (blockingIssue) {
      return { success: false, error: blockingIssue };
    }

    const reviewed = await db.$transaction(async (tx) => {
      await tx.employeeShiftOverride.upsert({
        where: {
          employeeId_workDate: {
            employeeId: existing.employeeId,
            workDate,
          },
        },
        update: {
          shiftId: existing.requestedShiftId,
          source: "APPROVED_REQUEST",
          note: `Schedule change approved from request ${existing.id}`,
        },
        create: {
          employeeId: existing.employeeId,
          workDate,
          shiftId: existing.requestedShiftId,
          source: "APPROVED_REQUEST",
          note: `Schedule change approved from request ${existing.id}`,
        },
      });

      const existingAttendance = await tx.attendance.findUnique({
        where: {
          employeeId_workDate: {
            employeeId: existing.employeeId,
            workDate,
          },
        },
        select: { id: true },
      });

      if (existingAttendance) {
        await tx.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            expectedShiftId: existing.requestedShiftId,
            scheduledStartMinutes: existing.requestedStartMinutesSnapshot,
            scheduledEndMinutes: existing.requestedEndMinutesSnapshot,
          },
        });
      }

      return tx.scheduleChangeRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: ScheduleChangeRequestStatus.APPROVED,
          managerRemarks: parsed.data.managerRemarks ?? null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt,
        },
        include: {
          employee: { select: employeeRequestSelect },
          reviewedBy: { select: reviewedBySelect },
        },
      });
    });

    revalidateRequestLayouts();
    return { success: true, data: serializeScheduleChangeRequest(reviewed) };
  } catch (error) {
    console.error("Error reviewing schedule change request:", error);
    return {
      success: false,
      error: "Failed to review schedule change request.",
    };
  }
}

export async function reviewCashAdvanceRequest(
  input: RequestReviewPayload,
): Promise<{
  success: boolean;
  data?: CashAdvanceRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to review cash advance requests.",
      };
    }

    const parsed = cashAdvanceReviewSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid review data.",
      };
    }

    const existing = await db.cashAdvanceRequest.findUnique({
      where: { id: parsed.data.id },
      include: {
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            isArchived: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, error: "Cash advance request not found." };
    }
    if (existing.employee.isArchived) {
      return {
        success: false,
        error: "The employee linked to this request is archived.",
      };
    }
    if (existing.status !== CashAdvanceRequestStatus.PENDING_MANAGER) {
      return {
        success: false,
        error: "Only pending review requests can be reviewed.",
      };
    }

    const now = new Date();

    if (parsed.data.decision === "REJECTED") {
      const reviewed = await db.cashAdvanceRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: CashAdvanceRequestStatus.REJECTED,
          managerRemarks: parsed.data.managerRemarks ?? null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt: now,
        },
        include: {
          employee: { select: employeeRequestSelect },
          reviewedBy: { select: reviewedBySelect },
          deductionAssignment: {
            select: {
              id: true,
              status: true,
              effectiveFrom: true,
              remainingBalance: true,
            },
          },
        },
      });

      revalidateRequestLayouts();
      return { success: true, data: serializeCashAdvanceRequest(reviewed) };
    }

    const deductionType = await db.deductionType.findFirst({
      where: {
        code: CASH_ADVANCE_DEDUCTION_CODE,
        isActive: true,
        amountMode: DeductionAmountMode.FIXED,
        frequency: DeductionFrequency.INSTALLMENT,
      },
      select: {
        id: true,
      },
    });

    if (!deductionType) {
      return {
        success: false,
        error:
          "An active installment deduction type with code CASH_ADVANCE is required before approving this request.",
      };
    }

    const duplicateAssignmentMessage =
      "A cash advance deduction already exists for this employee on the selected start date. Adjust the request start date or settle the existing record first.";

    try {
      const reviewed = await db.$transaction(async (tx) => {
        const fresh = await tx.cashAdvanceRequest.findUnique({
          where: { id: parsed.data.id },
          include: {
            employee: { select: employeeRequestSelect },
            reviewedBy: { select: reviewedBySelect },
            deductionAssignment: {
              select: {
                id: true,
                status: true,
                effectiveFrom: true,
                remainingBalance: true,
              },
            },
          },
        });

        if (!fresh) {
          throw new Error("Cash advance request not found.");
        }
        if (fresh.status !== CashAdvanceRequestStatus.PENDING_MANAGER) {
          throw new Error("This cash advance request has already been reviewed.");
        }

        const assignment = await tx.employeeDeductionAssignment.create({
          data: {
            employeeId: fresh.employeeId,
            deductionTypeId: deductionType.id,
            effectiveFrom: fresh.preferredStartDate,
            installmentTotal: fresh.amount,
            installmentPerPayroll: fresh.repaymentPerPayroll,
            remainingBalance: fresh.amount,
            workflowStatus: EmployeeDeductionWorkflowStatus.APPROVED,
            status: EmployeeDeductionAssignmentStatus.ACTIVE,
            reason: fresh.reason
              ? `Cash advance request: ${fresh.reason}`
              : "Cash advance request approved by manager",
            assignedByUserId: session.userId ?? null,
            updatedByUserId: session.userId ?? null,
            submittedAt: now,
            reviewedByUserId: session.userId ?? null,
            reviewedAt: now,
            reviewRemarks: "Created automatically from approved cash advance request.",
          },
          select: {
            id: true,
          },
        });

        return tx.cashAdvanceRequest.update({
          where: { id: parsed.data.id },
          data: {
            status: CashAdvanceRequestStatus.APPROVED,
            managerRemarks: parsed.data.managerRemarks ?? null,
            reviewedByUserId: session.userId ?? null,
            reviewedAt: now,
            deductionAssignmentId: assignment.id,
          },
          include: {
            employee: { select: employeeRequestSelect },
            reviewedBy: { select: reviewedBySelect },
            deductionAssignment: {
              select: {
                id: true,
                status: true,
                effectiveFrom: true,
                remainingBalance: true,
              },
            },
          },
        });
      });

      revalidateRequestLayouts();
      return { success: true, data: serializeCashAdvanceRequest(reviewed) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { success: false, error: duplicateAssignmentMessage };
      }
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      throw error;
    }
  } catch (error) {
    console.error("Error reviewing cash advance request:", error);
    return { success: false, error: "Failed to review cash advance request." };
  }
}

export async function reviewLeaveRequest(
  input: RequestReviewPayload,
): Promise<{
  success: boolean;
  data?: LeaveRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to review leave requests.",
      };
    }

    const parsed = leaveReviewSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid review data.",
      };
    }

    const existing = await db.leaveRequest.findUnique({
      where: { id: parsed.data.id },
      include: {
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            isArchived: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, error: "Leave request not found." };
    }
    if (existing.employee.isArchived) {
      return {
        success: false,
        error: "The employee linked to this request is archived.",
      };
    }
    if (existing.status !== LeaveRequestStatus.PENDING_MANAGER) {
      return {
        success: false,
        error: "Only pending review requests can be reviewed.",
      };
    }

    const reviewedAt = new Date();

    if (parsed.data.decision === "REJECTED") {
      const reviewed = await db.leaveRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: LeaveRequestStatus.REJECTED,
          managerRemarks: parsed.data.managerRemarks ?? null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt,
        },
        include: {
          employee: { select: employeeRequestSelect },
          reviewedBy: { select: reviewedBySelect },
          attendances: {
            select: {
              workDate: true,
              isPaidLeave: true,
            },
          },
        },
      });

      revalidateRequestLayouts();
      return { success: true, data: serializeLeaveRequest(reviewed) };
    }

    const leaveDays = enumerateZonedDaysInclusive(
      existing.startDate,
      existing.endDate,
    );
    const leaveDayKeys = new Set(leaveDays.map((day) => toZonedDayKey(day)));
    const paidDateKeys = Array.from(
      new Set((parsed.data.paidDates ?? []).map((day) => toZonedDayKey(day))),
    );
    const invalidPaidDateKey = paidDateKeys.find((dayKey) => !leaveDayKeys.has(dayKey));
    if (invalidPaidDateKey) {
      return {
        success: false,
        error:
          "Paid leave dates must stay inside the requested leave date range.",
      };
    }
    const firstDay = leaveDays[0];
    const lastExclusive = new Date(leaveDays[leaveDays.length - 1].getTime() + DAY_MS);

    const existingAttendanceRows = await db.attendance.findMany({
      where: {
        employeeId: existing.employeeId,
        workDate: {
          gte: firstDay,
          lt: lastExclusive,
        },
      },
      select: {
        id: true,
        workDate: true,
        isLocked: true,
        payrollPeriodId: true,
        actualInAt: true,
        actualOutAt: true,
        workedMinutes: true,
        netWorkedMinutes: true,
      },
    });

    const payrollLinkedRow = existingAttendanceRows.find(
      (row) => row.payrollPeriodId,
    );
    if (payrollLinkedRow) {
      return {
        success: false,
        error: `Cannot approve leave for ${shortDate(
          payrollLinkedRow.workDate,
        )}. Attendance is already linked to payroll.`,
      };
    }

    const lockedRow = existingAttendanceRows.find((row) => row.isLocked);
    if (lockedRow) {
      return {
        success: false,
        error: `Cannot approve leave for ${shortDate(
          lockedRow.workDate,
        )}. Attendance is locked for that date.`,
      };
    }

    const workedRow = existingAttendanceRows.find(
      (row) =>
        Boolean(row.actualInAt) ||
        Boolean(row.actualOutAt) ||
        Math.max(0, row.workedMinutes ?? 0) > 0 ||
        Math.max(0, row.netWorkedMinutes ?? 0) > 0,
    );
    if (workedRow) {
      return {
        success: false,
        error: `Cannot approve leave for ${shortDate(
          workedRow.workDate,
        )}. Attendance already has recorded work on that date.`,
      };
    }

    const expectedShifts = await Promise.all(
      leaveDays.map(async (day) => ({
        day,
        dayKey: toZonedDayKey(day),
        expected: await getExpectedShiftForDate(existing.employeeId, day),
      })),
    );

    const unscheduledPaidDay = expectedShifts.find(
      ({ dayKey, expected }) =>
        paidDateKeys.includes(dayKey) &&
        !expected.shift &&
        expected.scheduledStartMinutes == null &&
        expected.scheduledEndMinutes == null,
    );
    if (unscheduledPaidDay) {
      return {
        success: false,
        error: `Cannot mark ${shortDate(
          unscheduledPaidDay.day,
        )} as paid leave because that date has no scheduled work.`,
      };
    }

    const reviewed = await db.$transaction(async (tx) => {
      for (const { day, dayKey, expected } of expectedShifts) {
        const isPaidLeave = paidDateKeys.includes(dayKey);
        await tx.attendance.upsert({
          where: {
            employeeId_workDate: {
              employeeId: existing.employeeId,
              workDate: day,
            },
          },
          update: {
            status: ATTENDANCE_STATUS.LEAVE,
            isPaidLeave,
            leaveRequestId: existing.id,
            expectedShiftId: expected.shift?.id ?? null,
            scheduledStartMinutes: expected.scheduledStartMinutes,
            scheduledEndMinutes: expected.scheduledEndMinutes,
            paidHoursPerDay: expected.shift?.paidHoursPerDay ?? null,
            actualInAt: null,
            actualOutAt: null,
            workedMinutes: null,
            breakMinutes: 0,
            deductedBreakMinutes: 0,
            netWorkedMinutes: null,
            breakCount: 0,
            lateMinutes: 0,
            undertimeMinutes: 0,
            overtimeMinutesRaw: 0,
            overtimeMinutesApproved: 0,
            nightMinutes: 0,
          },
          create: {
            employeeId: existing.employeeId,
            workDate: day,
            status: ATTENDANCE_STATUS.LEAVE,
            isPaidLeave,
            leaveRequestId: existing.id,
            expectedShiftId: expected.shift?.id ?? null,
            scheduledStartMinutes: expected.scheduledStartMinutes,
            scheduledEndMinutes: expected.scheduledEndMinutes,
            paidHoursPerDay: expected.shift?.paidHoursPerDay ?? null,
            actualInAt: null,
            actualOutAt: null,
            workedMinutes: null,
            breakMinutes: 0,
            deductedBreakMinutes: 0,
            netWorkedMinutes: null,
            breakCount: 0,
            lateMinutes: 0,
            undertimeMinutes: 0,
            overtimeMinutesRaw: 0,
            overtimeMinutesApproved: 0,
            nightMinutes: 0,
            isLocked: false,
          },
        });
      }

      const reviewedRequest = await tx.leaveRequest.update({
        where: { id: parsed.data.id },
        data: {
          status: LeaveRequestStatus.APPROVED,
          managerRemarks: parsed.data.managerRemarks ?? null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt,
        },
        include: {
          employee: { select: employeeRequestSelect },
          reviewedBy: { select: reviewedBySelect },
          attendances: {
            select: {
              workDate: true,
              isPaidLeave: true,
            },
          },
        },
      });

      await syncEmployeeCurrentStatusFromApprovedLeave(
        tx,
        existing.employeeId,
        reviewedAt,
      );

      return reviewedRequest;
    });

    revalidateRequestLayouts();
    return { success: true, data: serializeLeaveRequest(reviewed) };
  } catch (error) {
    console.error("Error reviewing leave request:", error);
    return { success: false, error: "Failed to review leave request." };
  }
}
