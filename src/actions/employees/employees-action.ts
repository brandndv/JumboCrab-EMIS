"use server";

import {
  getDepartments as getDepartmentsImpl,
  getEmployeeByCode as getEmployeeByCodeImpl,
  getEmployeeById as getEmployeeByIdImpl,
  getEmployeeByUserId as getEmployeeByUserIdImpl,
  getEmployeeRateHistory as getEmployeeRateHistoryImpl,
  getEmployees as getEmployeesImpl,
  getEmployeesWithoutUser as getEmployeesWithoutUserImpl,
  getGeneratedEmployeeCode as getGeneratedEmployeeCodeImpl,
} from "./employees-query-action";
import {
  createEmployee as createEmployeeImpl,
  deleteEmployee as deleteEmployeeImpl,
  setEmployeeArchiveStatus as setEmployeeArchiveStatusImpl,
  updateEmployee as updateEmployeeImpl,
} from "./employees-mutation-action";

export async function getEmployees(...args: Parameters<typeof getEmployeesImpl>) {
  return getEmployeesImpl(...args);
}

export async function getEmployeeById(
  ...args: Parameters<typeof getEmployeeByIdImpl>
) {
  return getEmployeeByIdImpl(...args);
}

export async function getEmployeeRateHistory(
  ...args: Parameters<typeof getEmployeeRateHistoryImpl>
) {
  return getEmployeeRateHistoryImpl(...args);
}

export async function getGeneratedEmployeeCode(
  ...args: Parameters<typeof getGeneratedEmployeeCodeImpl>
) {
  return getGeneratedEmployeeCodeImpl(...args);
}

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

export async function getEmployeeByCode(
  ...args: Parameters<typeof getEmployeeByCodeImpl>
) {
  return getEmployeeByCodeImpl(...args);
}

export async function getEmployeeByUserId(
  ...args: Parameters<typeof getEmployeeByUserIdImpl>
) {
  return getEmployeeByUserIdImpl(...args);
}

export async function getEmployeesWithoutUser(
  ...args: Parameters<typeof getEmployeesWithoutUserImpl>
) {
  return getEmployeesWithoutUserImpl(...args);
}

export async function getDepartments(
  ...args: Parameters<typeof getDepartmentsImpl>
) {
  return getDepartmentsImpl(...args);
}

export type { EmployeeActionRecord, EmployeeRateHistoryItem } from "./types";
