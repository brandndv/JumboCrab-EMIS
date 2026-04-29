import { db } from "@/lib/db";

export type DepartmentOption = {
  departmentId: string;
  name: string;
};

export type DepartmentDetail = {
  departmentId: string;
  name: string;
  isActive: boolean;
  description?: string | null;
  positions: {
    positionId: string;
    name: string;
    isActive: boolean;
    employees: {
      employeeId: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
      img?: string | null;
    }[];
  }[];
  employees: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    img?: string | null;
    position?: {
      name: string | null;
      positionId: string | null;
      isActive: boolean | null;
    } | null;
  }[];
};

export const toPositionLabel = (position: {
  name: string;
  isActive: boolean;
}) => {
  const hasArchivedToken =
    position.name.includes("__deleted__") ||
    position.name.includes("__archived__");
  return !position.isActive || hasArchivedToken
    ? "Archived position"
    : position.name;
};

export const toDepartmentLabel = (name: string, isActive: boolean) => {
  if (isActive) return name;
  return (
    name
      .split("__archived__")[0]
      .split("__deleted__")[0]
      .trim() || "Archived department"
  );
};

export const isArchivedTokenName = (value: string) =>
  value.includes("__deleted__") || value.includes("__archived__");

const extractBaseName = (value: string) =>
  value
    .split("__archived__")[0]
    .split("__deleted__")[0]
    .trim();

export const resolveDepartmentRestoreName = async (
  departmentId: string,
  baseName: string,
) => {
  const normalizedBase = baseName.trim() || "Department";
  const directConflict = await db.department.findFirst({
    where: {
      departmentId: { not: departmentId },
      isActive: true,
      name: normalizedBase,
    },
    select: { departmentId: true },
  });
  if (!directConflict) return normalizedBase;

  let counter = 1;
  while (counter <= 999) {
    const candidate =
      counter === 1
        ? `${normalizedBase} (Restored)`
        : `${normalizedBase} (Restored ${counter})`;
    const conflict = await db.department.findFirst({
      where: {
        departmentId: { not: departmentId },
        isActive: true,
        name: candidate,
      },
      select: { departmentId: true },
    });
    if (!conflict) return candidate;
    counter += 1;
  }

  return `${normalizedBase} (${Date.now()})`;
};

export const getDepartmentBaseName = (value: string) => extractBaseName(value);
