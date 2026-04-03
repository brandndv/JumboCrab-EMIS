"use server";

import { db } from "@/lib/db";
import { DayShiftMap } from "./schedule-shared";

export async function assignPatternToEmployee(input: {
  employeeId: string;
  patternId: string;
  effectiveDate?: string;
}) {
  try {
    const employeeId =
      typeof input.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : "";
    const patternId =
      typeof input.patternId === "string" && input.patternId.trim()
        ? input.patternId.trim()
        : "";
    const effectiveDateRaw = input.effectiveDate;

    if (!employeeId || !patternId) {
      return { success: false, error: "employeeId and patternId are required" };
    }

    const effectiveDate = effectiveDateRaw ? new Date(effectiveDateRaw) : new Date();
    if (Number.isNaN(effectiveDate.getTime())) {
      return { success: false, error: "effectiveDate is invalid" };
    }
    effectiveDate.setHours(0, 0, 0, 0);

    const [employee, pattern] = await Promise.all([
      db.employee.findUnique({ where: { employeeId }, select: { employeeId: true } }),
      db.weeklyPattern.findUnique({
        where: { id: patternId },
        select: {
          id: true,
          isActive: true,
          sunShiftId: true,
          monShiftId: true,
          tueShiftId: true,
          wedShiftId: true,
          thuShiftId: true,
          friShiftId: true,
          satShiftId: true,
        },
      }),
    ]);

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }
    if (!pattern) {
      return { success: false, error: "Pattern not found" };
    }
    if (!pattern.isActive) {
      return { success: false, error: "Pattern is inactive" };
    }

    const dayStart = new Date(effectiveDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    await db.employeePatternAssignment.deleteMany({
      where: {
        employeeId,
        effectiveDate: { gte: dayStart, lt: dayEnd },
      },
    });

    const assignment = await db.employeePatternAssignment.create({
      data: {
        employeeId,
        patternId,
        effectiveDate: dayStart,
        sunShiftIdSnapshot: pattern.sunShiftId,
        monShiftIdSnapshot: pattern.monShiftId,
        tueShiftIdSnapshot: pattern.tueShiftId,
        wedShiftIdSnapshot: pattern.wedShiftId,
        thuShiftIdSnapshot: pattern.thuShiftId,
        friShiftIdSnapshot: pattern.friShiftId,
        satShiftIdSnapshot: pattern.satShiftId,
      },
    });

    return {
      success: true,
      data: {
        id: assignment.id,
        employeeId: assignment.employeeId,
        effectiveDate: assignment.effectiveDate.toISOString(),
        patternId: assignment.patternId,
      },
    };
  } catch (error) {
    console.error("Failed to assign pattern", error);
    return { success: false, error: "Failed to assign pattern" };
  }
}

export async function createEmployeePatternOverride(input: {
  employeeId: string;
  sourceAssignmentId?: string;
  sunShiftId?: number | null;
  monShiftId?: number | null;
  tueShiftId?: number | null;
  wedShiftId?: number | null;
  thuShiftId?: number | null;
  friShiftId?: number | null;
  satShiftId?: number | null;
}) {
  try {
    const employeeId =
      typeof input.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : "";
    if (!employeeId) {
      return { success: false, error: "employeeId is required" };
    }

    const dayShifts: DayShiftMap = {
      sunShiftId: typeof input.sunShiftId === "number" ? input.sunShiftId : null,
      monShiftId: typeof input.monShiftId === "number" ? input.monShiftId : null,
      tueShiftId: typeof input.tueShiftId === "number" ? input.tueShiftId : null,
      wedShiftId: typeof input.wedShiftId === "number" ? input.wedShiftId : null,
      thuShiftId: typeof input.thuShiftId === "number" ? input.thuShiftId : null,
      friShiftId: typeof input.friShiftId === "number" ? input.friShiftId : null,
      satShiftId: typeof input.satShiftId === "number" ? input.satShiftId : null,
    };

    const shiftIds = Object.values(dayShifts).filter(
      (id): id is number => typeof id === "number",
    );
    const uniqueShiftIds = Array.from(new Set(shiftIds));

    const sourceAssignmentId =
      typeof input.sourceAssignmentId === "string" &&
      input.sourceAssignmentId.trim()
        ? input.sourceAssignmentId.trim()
        : "";

    const [employee, shiftsCount, sourceAssignment] = await Promise.all([
      db.employee.findUnique({
        where: { employeeId },
        select: { employeeId: true },
      }),
      uniqueShiftIds.length
        ? db.shift.count({ where: { id: { in: uniqueShiftIds } } })
        : Promise.resolve(0),
      sourceAssignmentId
        ? db.employeePatternAssignment.findUnique({
            where: { id: sourceAssignmentId },
            select: {
              id: true,
              employeeId: true,
              patternId: true,
              effectiveDate: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }
    if (uniqueShiftIds.length && shiftsCount !== uniqueShiftIds.length) {
      return { success: false, error: "One or more selected shifts were not found" };
    }
    if (!sourceAssignment || sourceAssignment.employeeId !== employeeId) {
      return {
        success: false,
        error: "A valid source assignment for this employee is required",
      };
    }

    const result = await db.employeePatternAssignment.update({
      where: { id: sourceAssignment.id },
      data: {
        reason: `OVERRIDE_FROM:${sourceAssignmentId}`,
        sunShiftIdSnapshot: dayShifts.sunShiftId,
        monShiftIdSnapshot: dayShifts.monShiftId,
        tueShiftIdSnapshot: dayShifts.tueShiftId,
        wedShiftIdSnapshot: dayShifts.wedShiftId,
        thuShiftIdSnapshot: dayShifts.thuShiftId,
        friShiftIdSnapshot: dayShifts.friShiftId,
        satShiftIdSnapshot: dayShifts.satShiftId,
      },
    });

    return {
      success: true,
      data: {
        patternId: result.patternId,
        assignmentId: result.id,
        employeeId: result.employeeId,
        effectiveDate: result.effectiveDate.toISOString(),
      },
    };
  } catch (error) {
    console.error("Failed to create employee pattern override", error);
    return {
      success: false,
      error: "Failed to create employee pattern override",
    };
  }
}
