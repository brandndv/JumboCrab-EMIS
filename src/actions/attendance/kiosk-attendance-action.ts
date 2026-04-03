"use server";

import { getKioskStatus as getKioskStatusImpl, searchKioskUsers as searchKioskUsersImpl } from "./kiosk-attendance-query-action";
import { recordKioskPunch as recordKioskPunchImpl } from "./kiosk-attendance-record-action";

export async function searchKioskUsers(
  ...args: Parameters<typeof searchKioskUsersImpl>
) {
  return searchKioskUsersImpl(...args);
}

export async function getKioskStatus(
  ...args: Parameters<typeof getKioskStatusImpl>
) {
  return getKioskStatusImpl(...args);
}

export async function recordKioskPunch(
  ...args: Parameters<typeof recordKioskPunchImpl>
) {
  return recordKioskPunchImpl(...args);
}
