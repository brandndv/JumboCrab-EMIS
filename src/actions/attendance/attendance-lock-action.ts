"use server";

import {
  autoLockAttendance as autoLockAttendanceImpl,
  setAttendanceLockState as setAttendanceLockStateImpl,
} from "./attendance-lock-mutation-action";
import {
  listAttendanceLockSummary as listAttendanceLockSummaryImpl,
  listLockableEmployees as listLockableEmployeesImpl,
} from "./attendance-lock-summary-action";

export async function listAttendanceLockSummary(
  ...args: Parameters<typeof listAttendanceLockSummaryImpl>
) {
  return listAttendanceLockSummaryImpl(...args);
}

export async function listLockableEmployees(
  ...args: Parameters<typeof listLockableEmployeesImpl>
) {
  return listLockableEmployeesImpl(...args);
}

export async function setAttendanceLockState(
  ...args: Parameters<typeof setAttendanceLockStateImpl>
) {
  return setAttendanceLockStateImpl(...args);
}

export async function autoLockAttendance(
  ...args: Parameters<typeof autoLockAttendanceImpl>
) {
  return autoLockAttendanceImpl(...args);
}
