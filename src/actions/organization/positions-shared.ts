import { db } from "@/lib/db";

export type PositionDetail = {
  positionId: string;
  name: string;
  isActive: boolean;
  description?: string | null;
  departmentId: string;
  department?: { departmentId: string; name: string } | null;
  employees: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null } | null;
  }[];
};

export const isArchivedTokenName = (value: string) =>
  value.includes("__deleted__") || value.includes("__archived__");

const extractBaseName = (value: string) =>
  value
    .split("__archived__")[0]
    .split("__deleted__")[0]
    .trim();

export const resolvePositionRestoreName = async (
  positionId: string,
  departmentId: string,
  baseName: string,
) => {
  const normalizedBase = baseName.trim() || "Position";
  const directConflict = await db.position.findFirst({
    where: {
      positionId: { not: positionId },
      departmentId,
      isActive: true,
      name: normalizedBase,
    },
    select: { positionId: true },
  });
  if (!directConflict) return normalizedBase;

  let counter = 1;
  while (counter <= 999) {
    const candidate =
      counter === 1
        ? `${normalizedBase} (Restored)`
        : `${normalizedBase} (Restored ${counter})`;
    const conflict = await db.position.findFirst({
      where: {
        positionId: { not: positionId },
        departmentId,
        isActive: true,
        name: candidate,
      },
      select: { positionId: true },
    });
    if (!conflict) return candidate;
    counter += 1;
  }

  return `${normalizedBase} (${Date.now()})`;
};

export const toDisplayName = (value: string) =>
  value
    .split("__archived__")[0]
    .split("__deleted__")[0]
    .trim() || "Archived position";

export const getPositionBaseName = (value: string) => extractBaseName(value);
