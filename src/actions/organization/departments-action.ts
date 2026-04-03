"use server";

import {
  archiveDepartment as archiveDepartmentImpl,
  createDepartment as createDepartmentImpl,
  unarchiveDepartment as unarchiveDepartmentImpl,
  updateDepartment as updateDepartmentImpl,
} from "./departments-mutation-action";
import {
  listDepartmentOptions as listDepartmentOptionsImpl,
  listDepartments as listDepartmentsImpl,
  listDepartmentsWithOptions as listDepartmentsWithOptionsImpl,
} from "./departments-query-action";

export async function listDepartments(
  ...args: Parameters<typeof listDepartmentsImpl>
) {
  return listDepartmentsImpl(...args);
}

export async function listDepartmentsWithOptions(
  ...args: Parameters<typeof listDepartmentsWithOptionsImpl>
) {
  return listDepartmentsWithOptionsImpl(...args);
}

export async function listDepartmentOptions(
  ...args: Parameters<typeof listDepartmentOptionsImpl>
) {
  return listDepartmentOptionsImpl(...args);
}

export async function archiveDepartment(
  ...args: Parameters<typeof archiveDepartmentImpl>
) {
  return archiveDepartmentImpl(...args);
}

export async function unarchiveDepartment(
  ...args: Parameters<typeof unarchiveDepartmentImpl>
) {
  return unarchiveDepartmentImpl(...args);
}

export async function createDepartment(
  ...args: Parameters<typeof createDepartmentImpl>
) {
  return createDepartmentImpl(...args);
}

export async function updateDepartment(
  ...args: Parameters<typeof updateDepartmentImpl>
) {
  return updateDepartmentImpl(...args);
}

export type { DepartmentDetail, DepartmentOption } from "./departments-shared";
