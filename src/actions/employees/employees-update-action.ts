"use server";

import { checkConnection, db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Employee as PrismaEmployee, Prisma } from "@prisma/client";
import { SUFFIX } from "@/lib/validations/employees";
import {
  isSameRate,
  normalizeEmployeeRelationIds,
  parseDateInput,
  revalidateEmployeePages,
  serializeEmployeeRecord,
  toRateNumber,
  validateEmployeeRelationIds,
} from "./employees-shared";
import type { EmployeeActionRecord } from "./types";

export async function updateEmployee(
  employeeData: Partial<PrismaEmployee> & {
    employeeId: string;
    rateEffectiveFrom?: string | Date | null;
    rateReason?: string | null;
  },
): Promise<{
  success: boolean;
  data?: EmployeeActionRecord;
  error?: string;
}> {
  const isConnected = await checkConnection();
  if (!isConnected) {
    throw new Error("Database connection not available");
  }

  try {
    const data = JSON.parse(JSON.stringify(employeeData));
    const { employeeId, rateEffectiveFrom, rateReason } = data;
    delete data.employeeId;
    delete data.rateEffectiveFrom;
    delete data.rateReason;

    if ("employeeCode" in data) {
      delete data.employeeCode;
    }

    const currentData = await db.employee.findUnique({
      where: { employeeId },
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        nationality: true,
        dailyRate: true,
        departmentId: true,
        positionId: true,
        startDate: true,
        updatedAt: true,
      },
    });

    if (!currentData) {
      return { success: false, error: "Employee not found" };
    }

    console.log(
      "[SERVER] Current employee data in DB:",
      JSON.stringify(currentData, null, 2),
    );

    const updateData: Record<string, unknown> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    const allowedFields = [
      "employeeCode",
      "firstName",
      "middleName",
      "lastName",
      "sex",
      "birthdate",
      "startDate",
      "civilStatus",
      "departmentId",
      "positionId",
      "supervisorUserId",
      "employmentStatus",
      "currentStatus",
      "nationality",
      "address",
      "city",
      "state",
      "postalCode",
      "country",
      "img",
      "endDate",
      "isEnded",
      "email",
      "phone",
      "description",
      "suffix",
      "emergencyContactName",
      "emergencyContactRelationship",
      "emergencyContactPhone",
      "emergencyContactEmail",
      "dailyRate",
      "userId",
    ] as const;

    allowedFields.forEach((field) => {
      if (field in data) {
        updateData[field] = data[field as keyof typeof data];
      }
    });

    const normalizedRelationIds = normalizeEmployeeRelationIds({
      userId: updateData.userId,
      departmentId: updateData.departmentId,
      positionId: updateData.positionId,
      supervisorUserId: updateData.supervisorUserId,
    });

    (["userId", "departmentId", "positionId", "supervisorUserId"] as const).forEach((field) => {
      if (field in updateData) {
        updateData[field] = normalizedRelationIds[field];
      }
    });

    const relationError =
      await validateEmployeeRelationIds(normalizedRelationIds);
    if (relationError) {
      return { success: false, error: relationError };
    }

    (["birthdate", "startDate", "endDate"] as const).forEach((field) => {
      if (field in updateData) {
        const value = updateData[field];
        if (value == null || value === "") {
          updateData[field] = field === "endDate" ? null : undefined;
          if (updateData[field] === undefined) delete updateData[field];
          return;
        }
        const parsed = parseDateInput(value);
        if (!parsed) {
          delete updateData[field];
        } else {
          updateData[field] = parsed;
        }
      }
    });

    if (data.suffix && !SUFFIX.includes(data.suffix)) {
      delete updateData.suffix;
    }

    const parsedRateEffectiveFrom = parseDateInput(rateEffectiveFrom);
    if (
      rateEffectiveFrom != null &&
      rateEffectiveFrom !== "" &&
      !parsedRateEffectiveFrom
    ) {
      return {
        success: false,
        error: "Rate effective date is invalid",
      };
    }
    const rateHistoryEffectiveFrom = parsedRateEffectiveFrom ?? new Date();
    const normalizedRateReason =
      typeof rateReason === "string" ? rateReason.trim() : "";

    if ("dailyRate" in updateData) {
      const value = updateData.dailyRate;
      if (value == null || value === "") {
        updateData.dailyRate = null;
      } else {
        const parsed =
          typeof value === "number" ? value : Number.parseFloat(String(value));
        if (Number.isNaN(parsed) || parsed < 0) {
          return {
            success: false,
            error: "Daily rate must be a valid non-negative number",
          };
        } else {
          updateData.dailyRate = parsed;
        }
      }
    }

    const hasDailyRateUpdate = Object.prototype.hasOwnProperty.call(
      updateData,
      "dailyRate",
    );
    const previousDailyRate = toRateNumber(currentData.dailyRate);
    const nextDailyRate = hasDailyRateUpdate
      ? toRateNumber(updateData.dailyRate)
      : null;

    const updatedEmployee = await db.employee.update({
      where: { employeeId },
      data: updateData as Prisma.EmployeeUncheckedUpdateInput,
    });
    const session = await getSession();
    const actorUserId = session.userId ?? null;

    if (hasDailyRateUpdate && !isSameRate(previousDailyRate, nextDailyRate)) {
      await db.employeeRateHistory.upsert({
        where: {
          employeeId_effectiveFrom: {
            employeeId,
            effectiveFrom: rateHistoryEffectiveFrom,
          },
        },
        create: {
          employeeId,
          dailyRate: nextDailyRate,
          hourlyRate: nextDailyRate == null ? null : nextDailyRate / 8,
          monthlyRate: nextDailyRate == null ? null : nextDailyRate * 22,
          effectiveFrom: rateHistoryEffectiveFrom,
          reason:
            normalizedRateReason ||
            (nextDailyRate == null ? "Daily rate cleared" : "Daily rate updated"),
          createdByUserId: actorUserId,
        },
        update: {
          dailyRate: nextDailyRate,
          hourlyRate: nextDailyRate == null ? null : nextDailyRate / 8,
          monthlyRate: nextDailyRate == null ? null : nextDailyRate * 22,
          reason:
            normalizedRateReason ||
            (nextDailyRate == null
              ? "Daily rate cleared (corrected)"
              : "Daily rate corrected"),
          createdByUserId: actorUserId,
        },
      });
    }

    const didPositionChange =
      updatedEmployee.departmentId !== currentData.departmentId ||
      updatedEmployee.positionId !== currentData.positionId;
    if (didPositionChange) {
      await db.employeePositionHistory.create({
        data: {
          employeeId,
          departmentId: updatedEmployee.departmentId,
          positionId: updatedEmployee.positionId,
          effectiveFrom:
            parseDateInput(updatedEmployee.startDate) ??
            rateHistoryEffectiveFrom ??
            new Date(),
          reason: "Position assignment updated",
          createdByUserId: actorUserId,
        },
      });
    }

    revalidateEmployeePages(employeeId);
    return { success: true, data: serializeEmployeeRecord(updatedEmployee) };
  } catch (error) {
    console.error("Error in updateEmployee:", error);
    return {
      success: false,
      error: `Failed to update employee: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}
