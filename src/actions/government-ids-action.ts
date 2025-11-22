"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { GovernmentId as PrismaGovernmentId } from "@prisma/client";
import {
  governmentIdSchema,
  type GovernmentIdInput,
} from "@/lib/validations/government-ids";

type GovernmentIdPayload = {
  employeeId: string | undefined;
  sssNumber?: string | null;
  philHealthNumber?: string | null;
  pagIbigNumber?: string | null;
  tinNumber?: string | null;
};

export async function getGovernmentIdByEmployee(
  employeeId: string | undefined
): Promise<{
  success: boolean;
  data?: PrismaGovernmentId | null;
  error?: string;
}> {
  try {
    if (!employeeId) {
      return { success: false, error: "Employee ID is required" };
    }

    const governmentId = await db.governmentId.findUnique({
      where: { employeeId },
    });

    return { success: true, data: governmentId ?? null };
  } catch (error) {
    console.error("Error fetching government ID:", error);
    return {
      success: false,
      error: "Failed to fetch government ID. Check server logs for details.",
    };
  }
}

export async function upsertGovernmentId({
  employeeId,
  sssNumber,
  philHealthNumber,
  pagIbigNumber,
  tinNumber,
}: GovernmentIdPayload): Promise<{
  success: boolean;
  data?: PrismaGovernmentId;
  error?: string;
}> {
  try {
    const validation: GovernmentIdInput = {
      employeeId: employeeId ?? "",
      sssNumber,
      philHealthNumber,
      pagIbigNumber,
      tinNumber,
    };

    const parsed = governmentIdSchema.safeParse(validation);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((issue) => issue.message)
        .filter(Boolean)
        .join(", ");
      return { success: false, error: message || "Invalid government ID data" };
    }

    const normalizedPayload = {
      sssNumber: parsed.data.sssNumber ?? null,
      philHealthNumber: parsed.data.philHealthNumber ?? null,
      pagIbigNumber: parsed.data.pagIbigNumber ?? null,
      tinNumber: parsed.data.tinNumber ?? null,
    };

    const existing = await db.governmentId.findUnique({
      where: { employeeId },
    });

    const record = existing
      ? await db.governmentId.update({
          where: { employeeId },
          data: normalizedPayload,
        })
      : await db.governmentId.create({
          data: {
            employeeId: employeeId!,
            ...normalizedPayload,
          },
        });

    revalidatePath(`/admin/employees/${employeeId}/view`);
    revalidatePath(`/admin/employees/${employeeId}`);

    return { success: true, data: record };
  } catch (error: unknown) {
    console.error("Error in upsertGovernmentId:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return {
      success: false,
      error: `Failed to update government ID: ${errorMessage}`,
    };
  }
}
