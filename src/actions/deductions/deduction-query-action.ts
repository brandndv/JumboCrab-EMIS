"use server";

import {
  EmployeeDeductionWorkflowStatus,
  Roles,
  type Prisma,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canCreateApprovedDeductionAssignments,
  canReviewDeductionAssignments,
  canSearchEmployeesForDeductions,
  canViewEmployeeDeductionDirectory,
  employeeDeductionAssignmentInclude,
  loadAssignmentRecord,
  serializeDeductionAssignment,
} from "./deductions-shared";
import type {
  DeductionAssignmentRow,
  DeductionEmployeeOption,
} from "./types";

export async function listEmployeesForDeduction(input?: {
  query?: string | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: DeductionEmployeeOption[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canSearchEmployeesForDeductions(session.role)) {
      return { success: false, error: "You are not allowed to load employees." };
    }

    const query = typeof input?.query === "string" ? input.query.trim() : "";
    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;
    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 40;
    const limit = Math.max(1, Math.min(limitRaw, 200));
    const queryTokens = query.split(/\s+/).filter(Boolean);

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
      orderBy: [{ employeeCode: "asc" }],
      take: limit,
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!employeeId) {
      return { success: true, data: employees };
    }

    const hasSelected = employees.some((row) => row.employeeId === employeeId);
    if (hasSelected) {
      return { success: true, data: employees };
    }

    const selected = await db.employee.findUnique({
      where: { employeeId },
      select: {
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        isArchived: true,
      },
    });

    if (!selected || selected.isArchived) {
      return { success: true, data: employees };
    }

    return { success: true, data: [selected, ...employees] };
  } catch (error) {
    console.error("Error listing employees for deductions:", error);
    return { success: false, error: "Failed to load employees." };
  }
}

export async function listEmployeeDeductionAssignments(input?: {
  employeeId?: string | null;
  assignmentId?: string | null;
  workflowStatuses?: EmployeeDeductionWorkflowStatus[] | null;
  directoryMode?: boolean | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;
    const assignmentId =
      typeof input?.assignmentId === "string" && input.assignmentId.trim()
        ? input.assignmentId.trim()
        : null;
    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 300;
    const limit = Math.max(1, Math.min(limitRaw, 500));

    const where: Prisma.EmployeeDeductionAssignmentWhereInput = {};

    if (session.role === Roles.Employee) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      where.employee = { userId: session.userId };
      where.workflowStatus = EmployeeDeductionWorkflowStatus.APPROVED;
    } else if (
      !canViewEmployeeDeductionDirectory(session.role) &&
      !canReviewDeductionAssignments(session.role)
    ) {
      return {
        success: false,
        error: "You are not allowed to view deduction assignments.",
      };
    }

    if (employeeId) where.employeeId = employeeId;
    if (assignmentId) where.id = assignmentId;
    if (
      session.role !== Roles.Employee &&
      Array.isArray(input?.workflowStatuses) &&
      input.workflowStatuses.length
    ) {
      where.workflowStatus = { in: input.workflowStatuses };
    }

    const rows = await db.employeeDeductionAssignment.findMany({
      where,
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: employeeDeductionAssignmentInclude,
    });

    return { success: true, data: rows.map(serializeDeductionAssignment) };
  } catch (error) {
    console.error("Error listing employee deduction assignments:", error);
    return {
      success: false,
      error: "Failed to load deduction assignments.",
    };
  }
}

export async function getEmployeeDeductionAssignment(
  assignmentId: string,
): Promise<{
  success: boolean;
  data?: DeductionAssignmentRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const id = typeof assignmentId === "string" ? assignmentId.trim() : "";
    if (!id) {
      return { success: false, error: "Assignment ID is required." };
    }

    const row = await loadAssignmentRecord(id);
    if (!row) {
      return { success: false, error: "Deduction assignment not found." };
    }

    if (canCreateApprovedDeductionAssignments(session.role)) {
      if (row.workflowStatus !== EmployeeDeductionWorkflowStatus.APPROVED) {
        return {
          success: false,
          error: "Only approved deduction assignments can be edited here.",
        };
      }
    } else {
      return {
        success: false,
        error: "You are not allowed to access this deduction assignment.",
      };
    }

    return { success: true, data: serializeDeductionAssignment(row) };
  } catch (error) {
    console.error("Error fetching deduction assignment:", error);
    return { success: false, error: "Failed to load deduction assignment." };
  }
}
