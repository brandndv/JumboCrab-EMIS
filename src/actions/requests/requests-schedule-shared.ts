import { ATTENDANCE_STATUS } from "@prisma/client";
import { db } from "@/lib/db";
import { getExpectedShiftForDate } from "@/lib/attendance";
import { shortDate, toEmployeeName } from "./requests-core-shared";
import type {
  DayOffPreview,
  ScheduleChangePreview,
  ScheduleChangeShiftOption,
  ScheduleSwapEmployeeOption,
  ScheduleSwapPreview,
} from "./types";

export const scheduleSwapEmployeeSelect = {
  employeeId: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  isArchived: true,
  userId: true,
} as const;

export const scheduleChangeShiftSelect = {
  id: true,
  code: true,
  name: true,
  startMinutes: true,
  endMinutes: true,
  spansMidnight: true,
  isActive: true,
} as const;

const formatMinutesForDisplay = (minutes: number | null | undefined) => {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  const normalized = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(mins).padStart(2, "0")} ${suffix}`;
};

export const formatShiftSnapshotLabel = (input: {
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

export const toScheduleChangeShiftOption = (shift: {
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

export const toScheduleSwapEmployeeOption = (employee: {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}): ScheduleSwapEmployeeOption => ({
  employeeId: employee.employeeId,
  employeeCode: employee.employeeCode,
  employeeName: toEmployeeName(employee),
});

const toScheduleSnapshot = (
  expected: Awaited<ReturnType<typeof getExpectedShiftForDate>>,
) => ({
  shiftId: expected.shift?.id ?? null,
  shiftCode: expected.shift?.code ?? null,
  shiftName: expected.shift?.name ?? null,
  startMinutes: expected.shift?.startMinutes ?? null,
  endMinutes: expected.shift?.endMinutes ?? null,
  spansMidnight: expected.shift?.spansMidnight ?? false,
});

export const buildScheduleChangePreview = async (
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

export const buildDayOffPreview = async (employeeId: string, workDate: Date) => {
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

export const buildScheduleSwapPreview = async (
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

export const getScheduleSwapBlockingIssue = async (
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
