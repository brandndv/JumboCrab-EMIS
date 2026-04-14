"use server";

import { listAttendance as listAttendanceImpl } from "./attendance-list-action";
import {
  autoLockAttendance as autoLockAttendanceImpl,
  listAttendanceLockSummary as listAttendanceLockSummaryImpl,
  listLockableEmployees as listLockableEmployeesImpl,
  setAttendanceLockState as setAttendanceLockStateImpl,
} from "./attendance-lock-action";
import {
  deletePunch as deletePunchImpl,
  listAttendancePunches as listAttendancePunchesImpl,
  recordAttendancePunch as recordAttendancePunchImpl,
  updatePunch as updatePunchImpl,
} from "./attendance-punch-action";
import {
  getSelfAttendanceStatus as getSelfAttendanceStatusImpl,
  recordSelfPunch as recordSelfPunchImpl,
} from "./attendance-self-action";
import {
  recomputeAttendance as recomputeAttendanceImpl,
  recomputeAttendanceForDate as recomputeAttendanceForDateImpl,
} from "./attendance-recompute-action";
import {
  getAttendancePunchClientConfig as getAttendancePunchClientConfigImpl,
  getAttendanceSecuritySettings as getAttendanceSecuritySettingsImpl,
  getSuspiciousAttendanceLogDetail as getSuspiciousAttendanceLogDetailImpl,
  listEmployeeDeviceRegistrations as listEmployeeDeviceRegistrationsImpl,
  listSuspiciousAttendanceLogs as listSuspiciousAttendanceLogsImpl,
} from "./attendance-security-query-action";
import {
  reviewSuspiciousAttendanceLog as reviewSuspiciousAttendanceLogImpl,
  updateAttendanceSecuritySettings as updateAttendanceSecuritySettingsImpl,
} from "./attendance-security-mutation-action";

export async function listAttendance(
  ...args: Parameters<typeof listAttendanceImpl>
) {
  return listAttendanceImpl(...args);
}

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

export async function listAttendancePunches(
  ...args: Parameters<typeof listAttendancePunchesImpl>
) {
  return listAttendancePunchesImpl(...args);
}

export async function updatePunch(
  ...args: Parameters<typeof updatePunchImpl>
) {
  return updatePunchImpl(...args);
}

export async function deletePunch(
  ...args: Parameters<typeof deletePunchImpl>
) {
  return deletePunchImpl(...args);
}

export async function autoLockAttendance(
  ...args: Parameters<typeof autoLockAttendanceImpl>
) {
  return autoLockAttendanceImpl(...args);
}

export async function getSelfAttendanceStatus(
  ...args: Parameters<typeof getSelfAttendanceStatusImpl>
) {
  return getSelfAttendanceStatusImpl(...args);
}

export async function recordSelfPunch(
  ...args: Parameters<typeof recordSelfPunchImpl>
) {
  return recordSelfPunchImpl(...args);
}

export async function recordAttendancePunch(
  ...args: Parameters<typeof recordAttendancePunchImpl>
) {
  return recordAttendancePunchImpl(...args);
}

export async function getAttendanceSecuritySettings(
  ...args: Parameters<typeof getAttendanceSecuritySettingsImpl>
) {
  return getAttendanceSecuritySettingsImpl(...args);
}

export async function getAttendancePunchClientConfig(
  ...args: Parameters<typeof getAttendancePunchClientConfigImpl>
) {
  return getAttendancePunchClientConfigImpl(...args);
}

export async function listSuspiciousAttendanceLogs(
  ...args: Parameters<typeof listSuspiciousAttendanceLogsImpl>
) {
  return listSuspiciousAttendanceLogsImpl(...args);
}

export async function getSuspiciousAttendanceLogDetail(
  ...args: Parameters<typeof getSuspiciousAttendanceLogDetailImpl>
) {
  return getSuspiciousAttendanceLogDetailImpl(...args);
}

export async function reviewSuspiciousAttendanceLog(
  ...args: Parameters<typeof reviewSuspiciousAttendanceLogImpl>
) {
  return reviewSuspiciousAttendanceLogImpl(...args);
}

export async function updateAttendanceSecuritySettings(
  ...args: Parameters<typeof updateAttendanceSecuritySettingsImpl>
) {
  return updateAttendanceSecuritySettingsImpl(...args);
}

export async function listEmployeeDeviceRegistrations(
  ...args: Parameters<typeof listEmployeeDeviceRegistrationsImpl>
) {
  return listEmployeeDeviceRegistrationsImpl(...args);
}

export async function recomputeAttendance(
  ...args: Parameters<typeof recomputeAttendanceImpl>
) {
  return recomputeAttendanceImpl(...args);
}

export async function recomputeAttendanceForDate(
  ...args: Parameters<typeof recomputeAttendanceForDateImpl>
) {
  return recomputeAttendanceForDateImpl(...args);
}
