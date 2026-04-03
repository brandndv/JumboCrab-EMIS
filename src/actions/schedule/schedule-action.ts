"use server";

import { getEmployeeMonthSchedule as getEmployeeMonthScheduleImpl } from "./employee-month-schedule-action";
import { getScheduleSnapshot as getScheduleSnapshotImpl } from "./schedule-snapshot-action";
import {
  assignPatternToEmployee as assignPatternToEmployeeImpl,
  createEmployeePatternOverride as createEmployeePatternOverrideImpl,
} from "./schedule-pattern-assignment-action";
import {
  deleteScheduleOverride as deleteScheduleOverrideImpl,
  listScheduleOverrides as listScheduleOverridesImpl,
  upsertScheduleOverride as upsertScheduleOverrideImpl,
} from "./schedule-override-action";

export async function getScheduleSnapshot(
  ...args: Parameters<typeof getScheduleSnapshotImpl>
) {
  return getScheduleSnapshotImpl(...args);
}

export async function getEmployeeMonthSchedule(
  ...args: Parameters<typeof getEmployeeMonthScheduleImpl>
) {
  return getEmployeeMonthScheduleImpl(...args);
}

export async function listScheduleOverrides(
  ...args: Parameters<typeof listScheduleOverridesImpl>
) {
  return listScheduleOverridesImpl(...args);
}

export async function upsertScheduleOverride(
  ...args: Parameters<typeof upsertScheduleOverrideImpl>
) {
  return upsertScheduleOverrideImpl(...args);
}

export async function deleteScheduleOverride(
  ...args: Parameters<typeof deleteScheduleOverrideImpl>
) {
  return deleteScheduleOverrideImpl(...args);
}

export async function assignPatternToEmployee(
  ...args: Parameters<typeof assignPatternToEmployeeImpl>
) {
  return assignPatternToEmployeeImpl(...args);
}

export async function createEmployeePatternOverride(
  ...args: Parameters<typeof createEmployeePatternOverrideImpl>
) {
  return createEmployeePatternOverrideImpl(...args);
}
