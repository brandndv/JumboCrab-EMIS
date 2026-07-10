import { revalidatePath } from "next/cache";
import {
  CURRENT_STATUS,
  LeaveRequestStatus,
  LeaveRequestType,
  Prisma,
  Roles,
} from "@prisma/client";
import { db } from "@/lib/db";
import { startOfZonedDay } from "@/lib/timezone";

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

export const CASH_ADVANCE_DEDUCTION_CODE = "CASH_ADVANCE";
export const CASH_ADVANCE_ONE_TIME_DEDUCTION_CODE = "CASH_ADVANCE_ONE_TIME";
export const PAID_LEAVE_ALLOWANCE_PER_YEAR = 5;
export const PAID_SICK_LEAVE_ALLOWANCE_PER_YEAR = 5;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const revalidateRequestLayouts = () => {
  REQUEST_LAYOUT_PATHS.forEach((path) => {
    revalidatePath(path, "layout");
  });
  RELATED_LAYOUT_PATHS.forEach((path) => {
    revalidatePath(path, "layout");
  });
};

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const canCreateEmployeeRequests = (role?: Roles) =>
  role === Roles.Employee;

export const canReviewRequests = (role?: Roles) =>
  role === Roles.Admin || role === Roles.Manager;

export const enumerateZonedDaysInclusive = (start: Date, end: Date) => {
  const days: Date[] = [];
  let cursor = startOfZonedDay(start);
  const finalDay = startOfZonedDay(end);
  while (cursor.getTime() <= finalDay.getTime()) {
    days.push(cursor);
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return days;
};

export const shortDate = (value: Date) =>
  value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const toZonedDayKey = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });

export const employeeRequestSelect = {
  employeeId: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
} as const;

export const reviewedBySelect = {
  userId: true,
  username: true,
} as const;

let scheduleChangeRangeColumnsPromise: Promise<boolean> | null = null;
let cashAdvanceApprovalColumnsPromise: Promise<boolean> | null = null;
let dayOffExtendedColumnsPromise: Promise<boolean> | null = null;

export const hasScheduleChangeRangeColumns = async () => {
  if (!scheduleChangeRangeColumnsPromise) {
    scheduleChangeRangeColumnsPromise = (async () => {
      try {
        const rows = await db.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'ScheduleChangeRequest'
            AND column_name IN ('startDate', 'endDate')
        `;

        const names = new Set(rows.map((row) => row.column_name));
        return names.has("startDate") && names.has("endDate");
      } catch (error) {
        console.error("Error checking ScheduleChangeRequest columns:", error);
        return false;
      }
    })();
  }

  return scheduleChangeRangeColumnsPromise;
};

export const buildScheduleChangeRequestSelect = (
  includeRangeColumns: boolean,
) =>
  ({
    id: true,
    employeeId: true,
    workDate: true,
    ...(includeRangeColumns ? { startDate: true, endDate: true } : {}),
    currentShiftIdSnapshot: true,
    currentShiftCodeSnapshot: true,
    currentShiftNameSnapshot: true,
    currentStartMinutesSnapshot: true,
    currentEndMinutesSnapshot: true,
    currentSpansMidnightSnapshot: true,
    requestedShiftId: true,
    requestedShiftCodeSnapshot: true,
    requestedShiftNameSnapshot: true,
    requestedStartMinutesSnapshot: true,
    requestedEndMinutesSnapshot: true,
    requestedSpansMidnightSnapshot: true,
    reason: true,
    status: true,
    managerRemarks: true,
    reviewedAt: true,
    submittedAt: true,
    createdAt: true,
    updatedAt: true,
    employee: { select: employeeRequestSelect },
    reviewedBy: { select: reviewedBySelect },
  }) satisfies Prisma.ScheduleChangeRequestSelect;

export const hasCashAdvanceApprovalColumns = async () => {
  if (!cashAdvanceApprovalColumnsPromise) {
    cashAdvanceApprovalColumnsPromise = (async () => {
      try {
        const rows = await db.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'CashAdvanceRequest'
            AND column_name IN (
              'approvedAmount',
              'approvedDeductionMode',
              'approvedRepaymentPerPayroll',
              'approvedEffectiveFrom'
            )
        `;

        const names = new Set(rows.map((row) => row.column_name));
        return (
          names.has("approvedAmount") &&
          names.has("approvedDeductionMode") &&
          names.has("approvedRepaymentPerPayroll") &&
          names.has("approvedEffectiveFrom")
        );
      } catch (error) {
        console.error("Error checking CashAdvanceRequest columns:", error);
        return false;
      }
    })();
  }

  return cashAdvanceApprovalColumnsPromise;
};

export const buildCashAdvanceRequestSelect = (
  includeApprovalColumns: boolean,
  includeDeductionAssignment = true,
) =>
  ({
    id: true,
    employeeId: true,
    amount: true,
    repaymentPerPayroll: true,
    preferredStartDate: true,
    ...(includeApprovalColumns
      ? {
          approvedAmount: true,
          approvedDeductionMode: true,
          approvedRepaymentPerPayroll: true,
          approvedEffectiveFrom: true,
        }
      : {}),
    reason: true,
    status: true,
    managerRemarks: true,
    submittedAt: true,
    reviewedAt: true,
    deductionAssignmentId: true,
    createdAt: true,
    updatedAt: true,
    employee: { select: employeeRequestSelect },
    reviewedBy: { select: reviewedBySelect },
    ...(includeDeductionAssignment
      ? {
          deductionAssignment: {
            select: {
              id: true,
              status: true,
              effectiveFrom: true,
              remainingBalance: true,
            },
          },
        }
      : {}),
  }) satisfies Prisma.CashAdvanceRequestSelect;

export const hasDayOffExtendedColumns = async () => {
  if (!dayOffExtendedColumnsPromise) {
    dayOffExtendedColumnsPromise = (async () => {
      try {
        const rows = await db.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'DayOffRequest'
            AND column_name IN (
              'sourceOffDate',
              'targetWorkDate',
              'sourceShiftIdSnapshot',
              'sourceShiftCodeSnapshot',
              'sourceShiftNameSnapshot',
              'sourceStartMinutesSnapshot',
              'sourceEndMinutesSnapshot',
              'sourceSpansMidnightSnapshot'
            )
        `;

        const names = new Set(rows.map((row) => row.column_name));
        return (
          names.has("sourceOffDate") &&
          names.has("targetWorkDate") &&
          names.has("sourceShiftIdSnapshot") &&
          names.has("sourceShiftCodeSnapshot") &&
          names.has("sourceShiftNameSnapshot") &&
          names.has("sourceStartMinutesSnapshot") &&
          names.has("sourceEndMinutesSnapshot") &&
          names.has("sourceSpansMidnightSnapshot")
        );
      } catch (error) {
        console.error("Error checking DayOffRequest columns:", error);
        return false;
      }
    })();
  }

  return dayOffExtendedColumnsPromise;
};

export const buildDayOffRequestSelect = (includeExtendedColumns: boolean) =>
  ({
    id: true,
    employeeId: true,
    workDate: true,
    ...(includeExtendedColumns
      ? {
          sourceOffDate: true,
          targetWorkDate: true,
          sourceShiftIdSnapshot: true,
          sourceShiftCodeSnapshot: true,
          sourceShiftNameSnapshot: true,
          sourceStartMinutesSnapshot: true,
          sourceEndMinutesSnapshot: true,
          sourceSpansMidnightSnapshot: true,
        }
      : {}),
    currentShiftIdSnapshot: true,
    currentShiftCodeSnapshot: true,
    currentShiftNameSnapshot: true,
    currentStartMinutesSnapshot: true,
    currentEndMinutesSnapshot: true,
    currentSpansMidnightSnapshot: true,
    reason: true,
    status: true,
    managerRemarks: true,
    reviewedAt: true,
    submittedAt: true,
    createdAt: true,
    updatedAt: true,
    employee: { select: employeeRequestSelect },
    reviewedBy: { select: reviewedBySelect },
  }) satisfies Prisma.DayOffRequestSelect;

export const toEmployeeName = (employee: {
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
    case LeaveRequestType.SIL:
    case LeaveRequestType.PERSONAL:
    case LeaveRequestType.EMERGENCY:
    case LeaveRequestType.UNPAID:
    default:
      return CURRENT_STATUS.ON_LEAVE;
  }
};

export const syncEmployeeCurrentStatusFromApprovedLeave = async (
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

export const getEmployeeForSession = async (userId: string) =>
  db.employee.findUnique({
    where: { userId },
    select: {
      employeeId: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      startDate: true,
      isArchived: true,
      userId: true,
    },
  });
