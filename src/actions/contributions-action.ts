"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  employeeContributionSchema,
  type EmployeeContributionInput,
} from "@/lib/validations/contributions";

type UpsertPayload = EmployeeContributionInput & {
  actorUserId?: string | null;
};

// Fetch a single employee contribution by employeeId
export async function getEmployeeContribution(employeeId: string | undefined) {
  try {
    if (!employeeId) {
      return { success: false, error: "Employee ID is required" };
    }

    const contribution = await db.employeeContribution.findUnique({
      where: { employeeId },
    });

    return { success: true, data: contribution ?? null };
  } catch (error) {
    console.error("Error fetching employee contribution:", error);
    return { success: false, error: "Failed to fetch contribution" };
  }
}

// Upsert a single employee contribution with basic auditing
export async function upsertEmployeeContribution(input: UpsertPayload) {
  try {
    const parsed = employeeContributionSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((e) => e.message)
        .filter(Boolean)
        .join(", ");
      return { success: false, error: message || "Invalid contribution data" };
    }

    const data = parsed.data;
    const actorId =
      input.actorUserId && input.actorUserId.trim() !== ""
        ? input.actorUserId
        : null;

    // Normalize payload for Prisma
    const payload = {
      sssEe: data.sssEe,
      sssEr: data.sssEr,
      isSssActive: data.isSssActive ?? true,
      philHealthEe: data.philHealthEe,
      philHealthEr: data.philHealthEr,
      isPhilHealthActive: data.isPhilHealthActive ?? true,
      pagIbigEe: data.pagIbigEe,
      pagIbigEr: data.pagIbigEr,
      isPagIbigActive: data.isPagIbigActive ?? true,
      withholdingEe: data.withholdingEe,
      withholdingEr: data.withholdingEr,
      isWithholdingActive: data.isWithholdingActive ?? true,
      effectiveDate: data.effectiveDate ?? new Date(),
      updatedById: actorId,
      // createdById set only on create below
    };

    const existing = await db.employeeContribution.findUnique({
      where: { employeeId: data.employeeId },
    });

    const record = existing
      ? await db.employeeContribution.update({
          where: { employeeId: data.employeeId },
          data: payload,
        })
      : await db.employeeContribution.create({
          data: {
            employeeId: data.employeeId,
            ...payload,
            createdById: actorId,
          },
        });

    // Revalidate typical admin routes; adjust if you have more pages.
    revalidatePath("/admin/contributions");
    revalidatePath(`/admin/employees/${data.employeeId}/view`);

    return { success: true, data: record };
  } catch (error) {
    console.error("Error upserting employee contribution:", error);
    return { success: false, error: "Failed to save contribution" };
  }
}

// Lightweight directory: list employees with their EE totals and updated info
export async function listContributionDirectory() {
  try {
    const employees = await db.employee.findMany({
      where: {
        // Hide inactive/ended users from the directory
        currentStatus: {
          notIn: ["INACTIVE", "ENDED"],
        },
      },
      orderBy: { lastName: "asc" },
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        department: true,
        img: true,
        contribution: true,
        updatedAt: true,
      },
    });

    const rows = employees.map((emp) => {
      const fullName = [emp.firstName, emp.lastName].filter(Boolean).join(" ");
      const c = emp.contribution;
      const num = (val: any) => (val === null || typeof val === "undefined" ? 0 : Number(val));
      const sssEe = num(c?.sssEe);
      const philHealthEe = num(c?.philHealthEe);
      const pagIbigEe = num(c?.pagIbigEe);
      const withholdingEe = num(c?.withholdingEe);
      const sssEr = num(c?.sssEr);
      const philHealthEr = num(c?.philHealthEr);
      const pagIbigEr = num(c?.pagIbigEr);
      const withholdingEr = num(c?.withholdingEr);
      const eeTotal = sssEe + philHealthEe + pagIbigEe + withholdingEe;
      return {
        employeeId: emp.employeeId,
        employeeCode: emp.employeeCode,
        employeeName: fullName || "Unnamed Employee",
        department: emp.department,
        avatarUrl: emp.img,
        updatedAt: c?.updatedAt?.toISOString() ?? emp.updatedAt.toISOString(),
        contribution: c
          ? {
              ...c,
              sssEe,
              philHealthEe,
              pagIbigEe,
              withholdingEe,
              sssEr,
              philHealthEr,
              pagIbigEr,
              withholdingEr,
            }
          : null,
        eeTotal,
        isSet: eeTotal > 0,
      };
    });

    return { success: true, data: rows };
  } catch (error) {
    console.error("Error listing contribution directory:", error);
    return { success: false, error: "Failed to load contributions" };
  }
}
