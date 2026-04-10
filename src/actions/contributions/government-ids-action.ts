"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  ContributionType,
  type GovernmentId as PrismaGovernmentId,
} from "@prisma/client";
import {
  contributionPayrollInclusionSchema,
  governmentIdSchema,
  type ContributionPayrollInclusionInput,
  type GovernmentIdInput,
} from "@/lib/validations/government-ids";

type GovernmentIdPayload = {
  employeeId: string | undefined;
  sssNumber?: string | null;
  philHealthNumber?: string | null;
  pagIbigNumber?: string | null;
  tinNumber?: string | null;
  isSssIncludedInPayroll?: boolean;
  isPhilHealthIncludedInPayroll?: boolean;
  isPagIbigIncludedInPayroll?: boolean;
  isWithholdingIncludedInPayroll?: boolean;
};

export type GovernmentIdRecord = {
  governmentId: string;
  employeeId: string;
  sssNumber: string | null;
  isSssIncludedInPayroll: boolean;
  philHealthNumber: string | null;
  isPhilHealthIncludedInPayroll: boolean;
  tinNumber: string | null;
  isWithholdingIncludedInPayroll: boolean;
  pagIbigNumber: string | null;
  isPagIbigIncludedInPayroll: boolean;
  createdAt: string;
  updatedAt: string;
};

const contributionInclusionField = (contributionType: ContributionType) => {
  if (contributionType === ContributionType.SSS) {
    return "isSssIncludedInPayroll" as const;
  }
  if (contributionType === ContributionType.PHILHEALTH) {
    return "isPhilHealthIncludedInPayroll" as const;
  }
  if (contributionType === ContributionType.PAGIBIG) {
    return "isPagIbigIncludedInPayroll" as const;
  }
  return "isWithholdingIncludedInPayroll" as const;
};

const revalidateGovernmentContributionPaths = (employeeId: string) => {
  revalidatePath("/admin/contributions");
  revalidatePath("/manager/contributions");
  revalidatePath("/generalManager/reports/contributions");
  revalidatePath("/generalManager/reports/contributions-deductions");
  revalidatePath("/manager/reports/contributions");
  revalidatePath("/manager/reports/contributions-deductions");
  revalidatePath(`/admin/contributions/${employeeId}`);
  revalidatePath(`/manager/contributions/${employeeId}`);
  revalidatePath(`/admin/employees/${employeeId}/view`);
  revalidatePath(`/manager/employees/${employeeId}/view`);
  revalidatePath(`/generalManager/employees/${employeeId}/view`);
};

const serializeGovernmentId = (
  record: PrismaGovernmentId
): GovernmentIdRecord => ({
  governmentId: record.governmentId,
  employeeId: record.employeeId,
  sssNumber: record.sssNumber ?? null,
  isSssIncludedInPayroll: record.isSssIncludedInPayroll,
  philHealthNumber: record.philHealthNumber ?? null,
  isPhilHealthIncludedInPayroll: record.isPhilHealthIncludedInPayroll,
  tinNumber: record.tinNumber ?? null,
  isWithholdingIncludedInPayroll: record.isWithholdingIncludedInPayroll,
  pagIbigNumber: record.pagIbigNumber ?? null,
  isPagIbigIncludedInPayroll: record.isPagIbigIncludedInPayroll,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

const serializeGovernmentIdNullable = (
  record: PrismaGovernmentId | null
): GovernmentIdRecord | null => (record ? serializeGovernmentId(record) : null);

export async function getGovernmentIdByEmployee(
  employeeId: string | undefined
): Promise<{
  success: boolean;
  data?: GovernmentIdRecord | null;
  error?: string;
}> {
  try {
    if (!employeeId) {
      return { success: false, error: "Employee ID is required" };
    }

    const governmentId = await db.governmentId.findUnique({
      where: { employeeId },
    });

    return { success: true, data: serializeGovernmentIdNullable(governmentId) };
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
  isSssIncludedInPayroll,
  isPhilHealthIncludedInPayroll,
  isPagIbigIncludedInPayroll,
  isWithholdingIncludedInPayroll,
}: GovernmentIdPayload): Promise<{
  success: boolean;
  data?: GovernmentIdRecord;
  error?: string;
}> {
  try {
    const validation: GovernmentIdInput = {
      employeeId: employeeId ?? "",
      sssNumber,
      philHealthNumber,
      pagIbigNumber,
      tinNumber,
      isSssIncludedInPayroll,
      isPhilHealthIncludedInPayroll,
      isPagIbigIncludedInPayroll,
      isWithholdingIncludedInPayroll,
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
      ...(typeof parsed.data.isSssIncludedInPayroll === "boolean"
        ? { isSssIncludedInPayroll: parsed.data.isSssIncludedInPayroll }
        : {}),
      ...(typeof parsed.data.isPhilHealthIncludedInPayroll === "boolean"
        ? {
            isPhilHealthIncludedInPayroll:
              parsed.data.isPhilHealthIncludedInPayroll,
          }
        : {}),
      ...(typeof parsed.data.isPagIbigIncludedInPayroll === "boolean"
        ? { isPagIbigIncludedInPayroll: parsed.data.isPagIbigIncludedInPayroll }
        : {}),
      ...(typeof parsed.data.isWithholdingIncludedInPayroll === "boolean"
        ? {
            isWithholdingIncludedInPayroll:
              parsed.data.isWithholdingIncludedInPayroll,
          }
        : {}),
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

    revalidateGovernmentContributionPaths(employeeId!);
    revalidatePath(`/admin/employees/${employeeId}`);

    return { success: true, data: serializeGovernmentId(record) };
  } catch (error: unknown) {
    console.error("Error in upsertGovernmentId:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return {
      success: false,
      error: `Failed to update government ID: ${errorMessage}`,
    };
  }
}

export async function updateContributionPayrollInclusion(
  input: ContributionPayrollInclusionInput,
): Promise<{
  success: boolean;
  data?: GovernmentIdRecord;
  error?: string;
}> {
  try {
    const parsed = contributionPayrollInclusionSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((issue) => issue.message)
        .filter(Boolean)
        .join(", ");
      return {
        success: false,
        error: message || "Invalid payroll inclusion settings",
      };
    }

    const inclusionField = contributionInclusionField(
      parsed.data.contributionType,
    );

    const existing = await db.governmentId.findUnique({
      where: { employeeId: parsed.data.employeeId },
    });

    const record = existing
      ? await db.governmentId.update({
          where: { employeeId: parsed.data.employeeId },
          data: {
            [inclusionField]: parsed.data.includeInPayroll,
          },
        })
      : await db.governmentId.create({
          data: {
            employeeId: parsed.data.employeeId,
            [inclusionField]: parsed.data.includeInPayroll,
          },
        });

    revalidateGovernmentContributionPaths(parsed.data.employeeId);

    return { success: true, data: serializeGovernmentId(record) };
  } catch (error: unknown) {
    console.error("Error updating payroll inclusion:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return {
      success: false,
      error: `Failed to update payroll inclusion: ${errorMessage}`,
    };
  }
}
