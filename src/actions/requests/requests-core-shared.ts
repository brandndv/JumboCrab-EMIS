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
export const PAID_LEAVE_ALLOWANCE_PER_YEAR = 10;
export const PAID_SICK_LEAVE_ALLOWANCE_PER_YEAR = 10;
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
      isArchived: true,
      userId: true,
    },
  });
