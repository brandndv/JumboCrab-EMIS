"use server";

import { ATTENDANCE_STATUS, type Prisma } from "@prisma/client";
import { endOfZonedDay, startOfZonedDay } from "@/lib/timezone";
import {
  buildSingleDayAttendanceList,
  enrichAttendanceRecords,
  loadAttendanceListContext,
} from "./attendance-list-shared";

export async function listAttendance(input?: {
  start?: string | null;
  end?: string | null;
  employeeId?: string | null;
  status?: string | null;
  query?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  variance?: "OT" | "UT" | "LATE" | null;
  page?: number | null;
  pageSize?: number | null;
  includeAll?: boolean;
}) {
  try {
    const start = typeof input?.start === "string" ? input.start : null;
    const end = typeof input?.end === "string" ? input.end : null;
    const employeeId =
      typeof input?.employeeId === "string" ? input.employeeId.trim() : null;
    const status = typeof input?.status === "string" ? input.status : null;
    const query = typeof input?.query === "string" ? input.query.trim() : "";
    const queryTokens = query.split(/\s+/).filter(Boolean);
    const departmentId =
      typeof input?.departmentId === "string" ? input.departmentId.trim() : "";
    const positionId =
      typeof input?.positionId === "string" ? input.positionId.trim() : "";
    const variance = input?.variance ?? null;
    const includeAll = Boolean(input?.includeAll);
    const singleDay = Boolean(start && end && start === end);
    const pageRaw =
      typeof input?.page === "number" && Number.isFinite(input.page)
        ? Math.floor(input.page)
        : 1;
    const pageSizeRaw =
      typeof input?.pageSize === "number" && Number.isFinite(input.pageSize)
        ? Math.floor(input.pageSize)
        : 100;
    const page = Math.max(1, pageRaw);
    const pageSize = Math.max(10, Math.min(200, pageSizeRaw));
    const shouldPaginate = !includeAll;

    const where: Prisma.AttendanceWhereInput = {};
    if (start || end) {
      const workDate: Prisma.DateTimeFilter = {};
      if (start) {
        const parsedStart = new Date(start);
        if (!Number.isNaN(parsedStart.getTime())) {
          workDate.gte = startOfZonedDay(parsedStart);
        }
      }
      if (end) {
        const parsedEnd = new Date(end);
        if (!Number.isNaN(parsedEnd.getTime())) {
          workDate.lt = endOfZonedDay(parsedEnd);
        }
      }
      if (Object.keys(workDate).length > 0) {
        where.workDate = workDate;
      }
    }

    if (employeeId) where.employeeId = employeeId;
    if (
      status &&
      Object.values(ATTENDANCE_STATUS).includes(status as ATTENDANCE_STATUS)
    ) {
      where.status = status as ATTENDANCE_STATUS;
    }
    if (variance === "OT") where.overtimeMinutesRaw = { gt: 0 };
    if (variance === "UT") where.undertimeMinutes = { gt: 0 };
    if (variance === "LATE") where.lateMinutes = { gt: 0 };
    if (departmentId || positionId || queryTokens.length > 0) {
      const employeeWhere: Prisma.EmployeeWhereInput = {
        isArchived: false,
      };
      if (departmentId) {
        employeeWhere.departmentId = departmentId;
      }
      if (positionId) {
        employeeWhere.positionId = positionId;
      }
      if (queryTokens.length > 0) {
        employeeWhere.AND = queryTokens.map((token) => ({
          OR: [
            { employeeCode: { contains: token, mode: "insensitive" } },
            { firstName: { contains: token, mode: "insensitive" } },
            { middleName: { contains: token, mode: "insensitive" } },
            { lastName: { contains: token, mode: "insensitive" } },
            {
              department: {
                is: { name: { contains: token, mode: "insensitive" } },
              },
            },
            {
              position: {
                is: { name: { contains: token, mode: "insensitive" } },
              },
            },
          ],
        }));
      }
      where.employee = { is: employeeWhere };
    }

    const {
      records,
      totalCount,
      totalPages,
      safePage,
      effectiveDailyRates,
      punchesByEmployeeDay,
    } = await loadAttendanceListContext({
      where,
      page,
      pageSize,
      shouldPaginate,
    });

    const enriched = enrichAttendanceRecords({
      records,
      effectiveDailyRates,
      punchesByEmployeeDay,
    });

    if (includeAll && singleDay && start) {
      const parsedStart = new Date(start);
      if (Number.isNaN(parsedStart.getTime())) {
        return { success: false, error: "Invalid start date" };
      }
      return buildSingleDayAttendanceList({
        startDate: parsedStart,
        startLabel: start,
        enriched,
      });
    }

    return {
      success: true,
      data: enriched,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error("Failed to fetch attendance", error);
    return { success: false, error: "Failed to load attendance" };
  }
}
