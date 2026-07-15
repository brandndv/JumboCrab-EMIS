"use server";

import { getEmployeeMonthSchedule as getEmployeeMonthScheduleImpl } from "./employee-month-schedule-action";
import { getScheduleSnapshot as getScheduleSnapshotImpl } from "./schedule-snapshot-action";
import {
  deleteScheduleOverride as deleteScheduleOverrideImpl,
  listScheduleOverrides as listScheduleOverridesImpl,
  upsertScheduleOverride as upsertScheduleOverrideImpl,
} from "./schedule-override-action";
import {
  getWeekPlannerSnapshot as getWeekPlannerSnapshotImpl,
  saveWeekPlannerAssignments as saveWeekPlannerAssignmentsImpl,
} from "./week-planner-action";
import { getSupervisorTeamWeekSchedule as getSupervisorTeamWeekScheduleImpl } from "./supervisor-team-week-schedule-action";

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

export async function getWeekPlannerSnapshot(
  ...args: Parameters<typeof getWeekPlannerSnapshotImpl>
) {
  return getWeekPlannerSnapshotImpl(...args);
}

export async function saveWeekPlannerAssignments(
  ...args: Parameters<typeof saveWeekPlannerAssignmentsImpl>
) {
  return saveWeekPlannerAssignmentsImpl(...args);
}

export async function getSupervisorTeamWeekSchedule(
  ...args: Parameters<typeof getSupervisorTeamWeekScheduleImpl>
) {
  return getSupervisorTeamWeekScheduleImpl(...args);
}
