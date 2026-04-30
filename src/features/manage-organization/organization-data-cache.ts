"use client";

import {
  listDepartmentsWithOptions,
  type DepartmentDetail,
  type DepartmentOption,
} from "@/actions/organization/departments-action";
import {
  listPositions,
} from "@/actions/organization/positions-action";
import { getOrganizationStructure } from "@/actions/organization/organization-structure-action";

type DepartmentResult = Awaited<ReturnType<typeof listDepartmentsWithOptions>>;
type PositionResult = Awaited<ReturnType<typeof listPositions>>;
type StructureResult = Awaited<ReturnType<typeof getOrganizationStructure>>;

const departmentCache = new Map<string, Promise<DepartmentResult>>();
const positionCache = new Map<string, Promise<PositionResult>>();
let structurePromise: Promise<StructureResult> | null = null;

function getDepartmentsKey(includeArchived: boolean) {
  return includeArchived ? "archived" : "active";
}

function getPositionsKey(includeArchived: boolean) {
  return includeArchived ? "archived" : "active";
}

export function invalidateDepartmentData() {
  departmentCache.clear();
}

export function invalidatePositionData() {
  positionCache.clear();
}

export function invalidateStructureData() {
  structurePromise = null;
}

export function invalidateOrganizationData() {
  invalidateDepartmentData();
  invalidatePositionData();
  invalidateStructureData();
}

export function loadDepartmentsData(input?: {
  includeArchived?: boolean;
  force?: boolean;
}) {
  const includeArchived = Boolean(input?.includeArchived);
  const key = getDepartmentsKey(includeArchived);

  if (input?.force) {
    departmentCache.delete(key);
  }

  const existing = departmentCache.get(key);
  if (existing) return existing;

  const promise = listDepartmentsWithOptions({ includeArchived });
  departmentCache.set(key, promise);

  void promise.then((result) => {
    if (!result.success) {
      departmentCache.delete(key);
    }
  });

  return promise;
}

export async function loadDepartmentOptionsData(input?: {
  force?: boolean;
}): Promise<{
  success: boolean;
  data?: DepartmentOption[];
  error?: string;
}> {
  const result = await loadDepartmentsData({
    includeArchived: false,
    force: input?.force,
  });

  if (!result.success) {
    return { success: false, error: result.error || "Failed to load departments" };
  }

  const options: DepartmentOption[] = ((result.data ?? []) as DepartmentDetail[]).map(
    (department) => ({
      departmentId: department.departmentId,
      name: department.name,
    }),
  );

  return { success: true, data: options };
}

export function loadPositionsData(input?: {
  includeArchived?: boolean;
  force?: boolean;
}) {
  const includeArchived = Boolean(input?.includeArchived);
  const key = getPositionsKey(includeArchived);

  if (input?.force) {
    positionCache.delete(key);
  }

  const existing = positionCache.get(key);
  if (existing) return existing;

  const promise = listPositions({ includeArchived });
  positionCache.set(key, promise);

  void promise.then((result) => {
    if (!result.success) {
      positionCache.delete(key);
    }
  });

  return promise;
}

export function loadStructureData(input?: {
  force?: boolean;
}) {
  if (input?.force) {
    structurePromise = null;
  }

  if (structurePromise) return structurePromise;

  structurePromise = getOrganizationStructure();

  void structurePromise.then((result) => {
    if (!result.success) {
      structurePromise = null;
    }
  });

  return structurePromise;
}
