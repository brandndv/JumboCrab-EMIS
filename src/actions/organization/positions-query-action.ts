"use server";

import { db } from "@/lib/db";
import {
  type PositionDetail,
  toDisplayName,
} from "./positions-shared";

export async function listPositions(input?: {
  includeArchived?: boolean;
}): Promise<{
  success: boolean;
  data?: PositionDetail[];
  error?: string;
}> {
  try {
    const includeArchived = Boolean(input?.includeArchived);
    const rows = await db.position.findMany({
      where: includeArchived ? undefined : { isActive: true },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
      select: {
        positionId: true,
        name: true,
        isActive: true,
        description: true,
        departmentId: true,
        department: { select: { departmentId: true, name: true } },
        employees: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
    });
    const positions: PositionDetail[] = rows.map((row) => ({
      ...row,
      name: row.isActive ? row.name : toDisplayName(row.name),
    }));
    return { success: true, data: positions };
  } catch (error) {
    console.error("Failed to fetch positions", error);
    return { success: false, error: "Failed to load positions" };
  }
}
