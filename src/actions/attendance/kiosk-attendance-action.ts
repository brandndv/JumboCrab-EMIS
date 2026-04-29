"use server";

import { getKioskStatus as getKioskStatusImpl, searchKioskUsers as searchKioskUsersImpl } from "./kiosk-attendance-query-action";
import {
  acknowledgeKioskQrScan as acknowledgeKioskQrScanImpl,
  consumeKioskQrScanAcknowledgement as consumeKioskQrScanAcknowledgementImpl,
  recordKioskPunch as recordKioskPunchImpl,
  unlockKioskPasswordMode as unlockKioskPasswordModeImpl,
} from "./kiosk-attendance-record-action";

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

export async function unlockKioskPasswordMode(
  ...args: Parameters<typeof unlockKioskPasswordModeImpl>
) {
  return unlockKioskPasswordModeImpl(...args);
}

export async function acknowledgeKioskQrScan(
  ...args: Parameters<typeof acknowledgeKioskQrScanImpl>
) {
  return acknowledgeKioskQrScanImpl(...args);
}

export async function consumeKioskQrScanAcknowledgement(
  ...args: Parameters<typeof consumeKioskQrScanAcknowledgementImpl>
) {
  return consumeKioskQrScanAcknowledgementImpl(...args);
}
