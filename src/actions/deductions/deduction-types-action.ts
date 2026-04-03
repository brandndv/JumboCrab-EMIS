"use server";

import { DeductionAmountMode } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { deductionTypeSchema } from "@/lib/validations/deductions";
import {
  canManageDeductionTypes,
  canSearchEmployeesForDeductions,
  deductionTypeInclude,
  normalizeCode,
  revalidateDeductionLayouts,
  serializeDeductionType,
} from "./deductions-shared";
import type { DeductionTypePayload, DeductionTypeRow } from "./types";

export async function listDeductionTypes(input?: {
  includeInactive?: boolean | null;
}): Promise<{ success: boolean; data?: DeductionTypeRow[]; error?: string }> {
  try {
    const session = await getSession();
    if (
      !session?.isLoggedIn ||
      (!canManageDeductionTypes(session.role) &&
        !canSearchEmployeesForDeductions(session.role))
    ) {
      return {
        success: false,
        error: "You are not allowed to view deduction types.",
      };
    }

    const includeInactive =
      canManageDeductionTypes(session.role) &&
      typeof input?.includeInactive === "boolean"
        ? input.includeInactive
        : false;

    const rows = await db.deductionType.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ name: "asc" }],
      include: deductionTypeInclude,
    });

    return { success: true, data: rows.map(serializeDeductionType) };
  } catch (error) {
    console.error("Error listing deduction types:", error);
    return { success: false, error: "Failed to load deduction types." };
  }
}

export async function createDeductionType(
  input: DeductionTypePayload,
): Promise<{ success: boolean; data?: DeductionTypeRow; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageDeductionTypes(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create deduction types.",
      };
    }

    const parsed = deductionTypeSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      return { success: false, error: message || "Invalid deduction type data" };
    }

    const code = normalizeCode(parsed.data.code, parsed.data.name);
    if (!code) {
      return {
        success: false,
        error: "A valid deduction code could not be generated.",
      };
    }

    const duplicate = await db.deductionType.findFirst({
      where: {
        OR: [
          { code: { equals: code, mode: "insensitive" } },
          { name: { equals: parsed.data.name, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        success: false,
        error: "A deduction type with the same code or name already exists.",
      };
    }

    const created = await db.deductionType.create({
      data: {
        code,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        amountMode: parsed.data.amountMode,
        frequency: parsed.data.frequency,
        defaultAmount:
          parsed.data.amountMode === DeductionAmountMode.FIXED
            ? parsed.data.defaultAmount ?? null
            : null,
        defaultPercent:
          parsed.data.amountMode === DeductionAmountMode.PERCENT
            ? parsed.data.defaultPercent ?? null
            : null,
        isActive: parsed.data.isActive,
        createdByUserId: session.userId ?? null,
        updatedByUserId: session.userId ?? null,
      },
      include: deductionTypeInclude,
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionType(created) };
  } catch (error) {
    console.error("Error creating deduction type:", error);
    return { success: false, error: "Failed to create deduction type." };
  }
}

export async function updateDeductionType(input: {
  id: string;
} & DeductionTypePayload): Promise<{
  success: boolean;
  data?: DeductionTypeRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canManageDeductionTypes(session.role)) {
      return {
        success: false,
        error: "You are not allowed to update deduction types.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) {
      return { success: false, error: "Deduction type ID is required." };
    }

    const parsed = deductionTypeSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      return { success: false, error: message || "Invalid deduction type data" };
    }

    const existing = await db.deductionType.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Deduction type not found." };
    }

    const code = normalizeCode(parsed.data.code, parsed.data.name);
    if (!code) {
      return {
        success: false,
        error: "A valid deduction code could not be generated.",
      };
    }

    const duplicate = await db.deductionType.findFirst({
      where: {
        id: { not: id },
        OR: [
          { code: { equals: code, mode: "insensitive" } },
          { name: { equals: parsed.data.name, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        success: false,
        error: "A deduction type with the same code or name already exists.",
      };
    }

    const updated = await db.deductionType.update({
      where: { id },
      data: {
        code,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        amountMode: parsed.data.amountMode,
        frequency: parsed.data.frequency,
        defaultAmount:
          parsed.data.amountMode === DeductionAmountMode.FIXED
            ? parsed.data.defaultAmount ?? null
            : null,
        defaultPercent:
          parsed.data.amountMode === DeductionAmountMode.PERCENT
            ? parsed.data.defaultPercent ?? null
            : null,
        isActive: parsed.data.isActive,
        updatedByUserId: session.userId ?? null,
      },
      include: deductionTypeInclude,
    });

    revalidateDeductionLayouts();
    return { success: true, data: serializeDeductionType(updated) };
  } catch (error) {
    console.error("Error updating deduction type:", error);
    return { success: false, error: "Failed to update deduction type." };
  }
}
