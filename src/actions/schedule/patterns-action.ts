"use server";

import { db } from "@/lib/db";
import { serializePattern } from "@/lib/serializers/schedule";

const shiftSelect = {
  id: true,
  code: true,
  name: true,
  startMinutes: true,
  endMinutes: true,
  spansMidnight: true,
  breakStartMinutes: true,
  breakEndMinutes: true,
  breakMinutesUnpaid: true,
  paidHoursPerDay: true,
  notes: true,
};

export async function listPatterns() {
  try {
    const patterns = await db.weeklyPattern.findMany({
      where: {
        code: {
          not: {
            startsWith: "OVR-",
          },
        },
      },
      orderBy: { name: "asc" },
      include: {
        sunShift: { select: shiftSelect },
        monShift: { select: shiftSelect },
        tueShift: { select: shiftSelect },
        wedShift: { select: shiftSelect },
        thuShift: { select: shiftSelect },
        friShift: { select: shiftSelect },
        satShift: { select: shiftSelect },
      },
    });
    return { success: true, data: patterns.map((p) => serializePattern(p)) };
  } catch (error) {
    console.error("Failed to list patterns", error);
    return { success: false, error: "Failed to load patterns" };
  }
}

export async function createPattern(input: {
  code: string;
  name: string;
  sunShiftId?: number | null;
  monShiftId?: number | null;
  tueShiftId?: number | null;
  wedShiftId?: number | null;
  thuShiftId?: number | null;
  friShiftId?: number | null;
  satShiftId?: number | null;
}) {
  try {
    const code = typeof input.code === "string" ? input.code.trim() : "";
    const name = typeof input.name === "string" ? input.name.trim() : "";

    const shiftIds: Record<string, number | null> = {
      sunShiftId: typeof input.sunShiftId === "number" ? input.sunShiftId : null,
      monShiftId: typeof input.monShiftId === "number" ? input.monShiftId : null,
      tueShiftId: typeof input.tueShiftId === "number" ? input.tueShiftId : null,
      wedShiftId: typeof input.wedShiftId === "number" ? input.wedShiftId : null,
      thuShiftId: typeof input.thuShiftId === "number" ? input.thuShiftId : null,
      friShiftId: typeof input.friShiftId === "number" ? input.friShiftId : null,
      satShiftId: typeof input.satShiftId === "number" ? input.satShiftId : null,
    };

    if (!code || !name) {
      return { success: false, error: "code and name are required" };
    }

    const ids = Object.values(shiftIds).filter(
      (id): id is number => typeof id === "number"
    );
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length) {
      const count = await db.shift.count({
        where: { id: { in: uniqueIds } },
      });
      if (count !== uniqueIds.length) {
        return { success: false, error: "One or more shifts not found" };
      }
    }

    const pattern = await db.weeklyPattern.create({
      data: {
        code,
        name,
        ...shiftIds,
      },
    });

    return { success: true, data: serializePattern({ ...pattern } as any) };
  } catch (error) {
    console.error("Failed to create pattern", error);
    return { success: false, error: "Failed to create pattern" };
  }
}

export async function updatePattern(input: {
  id: string;
  code?: string;
  name?: string;
  sunShiftId?: number | null;
  monShiftId?: number | null;
  tueShiftId?: number | null;
  wedShiftId?: number | null;
  thuShiftId?: number | null;
  friShiftId?: number | null;
  satShiftId?: number | null;
}) {
  try {
    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) {
      return { success: false, error: "id is required" };
    }

    const existing = await db.weeklyPattern.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Pattern not found" };
    }

    const code =
      typeof input.code === "string" && input.code.trim()
        ? input.code.trim()
        : existing.code;
    const name =
      typeof input.name === "string" && input.name.trim()
        ? input.name.trim()
        : existing.name;

    const shiftIds: Record<string, number | null> = {
      sunShiftId:
        typeof input.sunShiftId === "number"
          ? input.sunShiftId
          : existing.sunShiftId,
      monShiftId:
        typeof input.monShiftId === "number"
          ? input.monShiftId
          : existing.monShiftId,
      tueShiftId:
        typeof input.tueShiftId === "number"
          ? input.tueShiftId
          : existing.tueShiftId,
      wedShiftId:
        typeof input.wedShiftId === "number"
          ? input.wedShiftId
          : existing.wedShiftId,
      thuShiftId:
        typeof input.thuShiftId === "number"
          ? input.thuShiftId
          : existing.thuShiftId,
      friShiftId:
        typeof input.friShiftId === "number"
          ? input.friShiftId
          : existing.friShiftId,
      satShiftId:
        typeof input.satShiftId === "number"
          ? input.satShiftId
          : existing.satShiftId,
    };

    if (!code || !name) {
      return { success: false, error: "code and name are required" };
    }

    const ids = Object.values(shiftIds).filter(
      (id): id is number => typeof id === "number"
    );
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length) {
      const count = await db.shift.count({
        where: { id: { in: uniqueIds } },
      });
      if (count !== uniqueIds.length) {
        return { success: false, error: "One or more shifts not found" };
      }
    }

    const pattern = await db.weeklyPattern.update({
      where: { id },
      data: {
        code,
        name,
        ...shiftIds,
      },
    });

    return { success: true, data: serializePattern({ ...pattern } as any) };
  } catch (error) {
    console.error("Failed to update pattern", error);
    return { success: false, error: "Failed to update pattern" };
  }
}

export async function deletePattern(id: string) {
  try {
    const patternId = typeof id === "string" ? id.trim() : "";
    if (!patternId) {
      return { success: false, error: "id is required" };
    }
    const existing = await db.weeklyPattern.findUnique({
      where: { id: patternId },
    });
    if (!existing) {
      return { success: false, error: "Pattern not found" };
    }
    await db.weeklyPattern.delete({ where: { id: patternId } });
    return { success: true };
  } catch (error) {
    console.error("Failed to delete pattern", error);
    return { success: false, error: "Failed to delete pattern" };
  }
}

export async function listPatternAssignments() {
  try {
    const assignments = await db.employeePatternAssignment.findMany({
      orderBy: [{ employeeId: "asc" }, { effectiveDate: "desc" }],
      include: {
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
        pattern: {
          include: {
            sunShift: { select: shiftSelect },
            monShift: { select: shiftSelect },
            tueShift: { select: shiftSelect },
            wedShift: { select: shiftSelect },
            thuShift: { select: shiftSelect },
            friShift: { select: shiftSelect },
            satShift: { select: shiftSelect },
          },
        },
      },
    });

    const latestByEmployee = new Set<string>();
    const withLatest = assignments.map((assignment) => {
      const isLatest = !latestByEmployee.has(assignment.employeeId);
      if (isLatest) latestByEmployee.add(assignment.employeeId);
      return {
        id: assignment.id,
        employeeId: assignment.employeeId,
        effectiveDate: assignment.effectiveDate.toISOString(),
        reason: assignment.reason ?? null,
        sunShiftIdSnapshot: assignment.sunShiftIdSnapshot,
        monShiftIdSnapshot: assignment.monShiftIdSnapshot,
        tueShiftIdSnapshot: assignment.tueShiftIdSnapshot,
        wedShiftIdSnapshot: assignment.wedShiftIdSnapshot,
        thuShiftIdSnapshot: assignment.thuShiftIdSnapshot,
        friShiftIdSnapshot: assignment.friShiftIdSnapshot,
        satShiftIdSnapshot: assignment.satShiftIdSnapshot,
        employee: assignment.employee,
        pattern: assignment.pattern ? serializePattern(assignment.pattern) : null,
        isLatest,
      };
    });

    return { success: true, data: withLatest };
  } catch (error) {
    console.error("Failed to fetch pattern assignments", error);
    return { success: false, error: "Failed to load assignments" };
  }
}

export async function deletePatternAssignment(id: string) {
  try {
    const assignmentId = typeof id === "string" ? id.trim() : "";
    if (!assignmentId) {
      return { success: false, error: "id is required" };
    }
    await db.employeePatternAssignment.delete({ where: { id: assignmentId } });
    return { success: true };
  } catch (error) {
    console.error("Failed to delete pattern assignment", error);
    return { success: false, error: "Failed to delete assignment" };
  }
}
