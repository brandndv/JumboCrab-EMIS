"use server";

import { type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  DAY_MS,
  getRangeBounds,
  parseDateInput,
  toDayKey,
} from "./attendance-shared";

export async function listAttendanceLockSummary(input?: {
  start?: string | null;
  end?: string | null;
}) {
  try {
    const startRaw = typeof input?.start === "string" ? input.start : "";
    if (!startRaw) {
      return { success: false, error: "start date is required" };
    }

    const startDate = parseDateInput(startRaw);
    if (!startDate) {
      return { success: false, error: "Invalid start date" };
    }

    const endRaw = typeof input?.end === "string" ? input.end : startRaw;
    const endDate = parseDateInput(endRaw);
    if (!endDate) {
      return { success: false, error: "Invalid end date" };
    }
    if (endDate.getTime() < startDate.getTime()) {
      return { success: false, error: "end date must be on/after start date" };
    }

    const { rangeStart, rangeEnd } = getRangeBounds(startDate, endDate);
    const rows = await db.attendance.findMany({
      where: {
        workDate: { gte: rangeStart, lt: rangeEnd },
      },
      select: {
        workDate: true,
        isLocked: true,
      },
    });

    const byDate = new Map<string, { totalRows: number; lockedRows: number }>();
    rows.forEach((row) => {
      const key = toDayKey(row.workDate);
      const current = byDate.get(key) ?? { totalRows: 0, lockedRows: 0 };
      current.totalRows += 1;
      if (row.isLocked) current.lockedRows += 1;
      byDate.set(key, current);
    });

    const data: Array<{
      date: string;
      totalRows: number;
      lockedRows: number;
      unlockedRows: number;
      lockState: "LOCKED" | "UNLOCKED" | "PARTIAL" | "NO_ROWS";
    }> = [];
    for (
      let cursor = new Date(rangeStart);
      cursor.getTime() < rangeEnd.getTime();
      cursor = new Date(cursor.getTime() + DAY_MS)
    ) {
      const key = toDayKey(cursor);
      const count = byDate.get(key) ?? { totalRows: 0, lockedRows: 0 };
      const unlockedRows = Math.max(0, count.totalRows - count.lockedRows);
      let lockState: "LOCKED" | "UNLOCKED" | "PARTIAL" | "NO_ROWS" = "NO_ROWS";
      if (count.totalRows > 0) {
        if (count.lockedRows === 0) {
          lockState = "UNLOCKED";
        } else if (count.lockedRows === count.totalRows) {
          lockState = "LOCKED";
        } else {
          lockState = "PARTIAL";
        }
      }
      data.push({
        date: key,
        totalRows: count.totalRows,
        lockedRows: count.lockedRows,
        unlockedRows,
        lockState,
      });
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Failed to list attendance lock summary", error);
    return { success: false, error: "Failed to load lock summary" };
  }
}

export async function listLockableEmployees(input?: {
  query?: string | null;
  limit?: number | null;
}) {
  try {
    const query = typeof input?.query === "string" ? input.query.trim() : "";
    const queryTokens = query.split(/\s+/).filter(Boolean);
    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 30;
    const limit = Math.max(1, Math.min(limitRaw, 200));

    const where: Prisma.EmployeeWhereInput = { isArchived: false };
    if (queryTokens.length > 0) {
      where.AND = queryTokens.map((token) => ({
        OR: [
          { employeeCode: { contains: token, mode: "insensitive" } },
          { firstName: { contains: token, mode: "insensitive" } },
          { middleName: { contains: token, mode: "insensitive" } },
          { lastName: { contains: token, mode: "insensitive" } },
        ],
      }));
    }

    const employees = await db.employee.findMany({
      where,
      orderBy: { employeeCode: "asc" },
      take: limit,
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
      },
    });

    return { success: true, data: employees };
  } catch (error) {
    console.error("Failed to list lockable employees", error);
    return { success: false, error: "Failed to load employees" };
  }
}
