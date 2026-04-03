"use server";

import { createEmployee as createEmployeeImpl } from "./employees-create-action";
import { updateEmployee as updateEmployeeImpl } from "./employees-update-action";
import {
  deleteEmployee as deleteEmployeeImpl,
  setEmployeeArchiveStatus as setEmployeeArchiveStatusImpl,
} from "./employees-status-action";

export async function createEmployee(
  ...args: Parameters<typeof createEmployeeImpl>
) {
  return createEmployeeImpl(...args);
}

export async function updateEmployee(
  ...args: Parameters<typeof updateEmployeeImpl>
) {
  return updateEmployeeImpl(...args);
}

export async function setEmployeeArchiveStatus(
  ...args: Parameters<typeof setEmployeeArchiveStatusImpl>
) {
  return setEmployeeArchiveStatusImpl(...args);
}

export async function deleteEmployee(
  ...args: Parameters<typeof deleteEmployeeImpl>
) {
  return deleteEmployeeImpl(...args);
}
