"use server";

import {
  DeductionAmountMode,
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
  GovernmentLoanAgency,
  GovernmentLoanAssistanceRequestStatus,
  Prisma,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfZonedDay } from "@/lib/timezone";
import {
  governmentLoanAssistanceRequestSchema,
  governmentLoanFinalizeSchema,
  governmentLoanStatusUpdateSchema,
} from "@/lib/validations/requests";
import {
  canCreateEmployeeRequests,
  canReviewRequests,
  employeeRequestSelect,
  getEmployeeForSession,
  revalidateRequestLayouts,
  reviewedBySelect,
  roundMoney,
  serializeGovernmentLoanAssistanceRequest,
  buildGovernmentLoanChecklist,
} from "./requests-shared";
import {
  notifyEmployeeOfRequestDecision,
  notifyManagersOfRequest,
} from "./requests-notifications";
import type {
  GovernmentLoanAssistanceRequestPayload,
  GovernmentLoanAssistanceRequestRow,
  GovernmentLoanFinalizePayload,
  GovernmentLoanStatusUpdatePayload,
} from "./types";

const GOVERNMENT_LOAN_DEDUCTION_CODE = "GOVERNMENT_LOAN";

const governmentLoanInclude = {
  employee: { select: employeeRequestSelect },
  reviewedBy: { select: reviewedBySelect },
  deductionAssignment: {
    select: {
      id: true,
      status: true,
      effectiveFrom: true,
      remainingBalance: true,
    },
  },
} satisfies Prisma.GovernmentLoanAssistanceRequestInclude;

const getRequiredGovernmentId = (input: {
  agency: GovernmentLoanAgency;
  governmentId: {
    sssNumber: string | null;
    pagIbigNumber: string | null;
  } | null;
}) => {
  if (input.agency === GovernmentLoanAgency.SSS_SALARY_LOAN) {
    return {
      value: input.governmentId?.sssNumber?.trim() ?? "",
      error:
        "Your SSS number must be completed before requesting SSS Salary Loan assistance.",
    };
  }

  return {
    value: input.governmentId?.pagIbigNumber?.trim() ?? "",
    error:
      "Your Pag-IBIG MID number must be completed before requesting Pag-IBIG MPL assistance.",
  };
};

const getGovernmentLoanAgencyName = (agency: GovernmentLoanAgency) =>
  agency === GovernmentLoanAgency.SSS_SALARY_LOAN
    ? "SSS Salary Loan"
    : "Pag-IBIG MPL";

const getRequestForReview = async (id: string) =>
  db.governmentLoanAssistanceRequest.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          employeeId: true,
          firstName: true,
          lastName: true,
          isArchived: true,
        },
      },
    },
  });

export async function listGovernmentLoanAssistanceRequests(input?: {
  statuses?: GovernmentLoanAssistanceRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: GovernmentLoanAssistanceRequestRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const limitRaw =
      typeof input?.limit === "number" && Number.isFinite(input.limit)
        ? Math.floor(input.limit)
        : 200;
    const limit = Math.max(1, Math.min(limitRaw, 500));
    const employeeId =
      typeof input?.employeeId === "string" && input.employeeId.trim()
        ? input.employeeId.trim()
        : null;

    const where: Prisma.GovernmentLoanAssistanceRequestWhereInput = {};

    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) {
        return { success: false, error: "Employee session is invalid." };
      }
      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      where.employeeId = employee.employeeId;
    } else if (canReviewRequests(session.role)) {
      if (employeeId) where.employeeId = employeeId;
    } else {
      return {
        success: false,
        error: "You are not allowed to view government loan assistance requests.",
      };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const rows = await db.governmentLoanAssistanceRequest.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { submittedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: limit,
      include: governmentLoanInclude,
    });

    return {
      success: true,
      data: rows.map(serializeGovernmentLoanAssistanceRequest),
    };
  } catch (error) {
    console.error("Error listing government loan assistance requests:", error);
    return {
      success: false,
      error: "Failed to load government loan assistance requests.",
    };
  }
}

export async function createGovernmentLoanAssistanceRequest(
  input: GovernmentLoanAssistanceRequestPayload,
): Promise<{
  success: boolean;
  data?: GovernmentLoanAssistanceRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create government loan assistance requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = governmentLoanAssistanceRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid request data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const employeeDetails = await db.employee.findUnique({
      where: { employeeId: employee.employeeId },
      select: {
        governmentId: {
          select: {
            sssNumber: true,
            pagIbigNumber: true,
          },
        },
        position: {
          select: {
            monthlyRate: true,
          },
        },
      },
    });

    const governmentId = getRequiredGovernmentId({
      agency: parsed.data.agency,
      governmentId: employeeDetails?.governmentId ?? null,
    });
    if (!governmentId.value) {
      return { success: false, error: governmentId.error };
    }

    const requestedAmount = roundMoney(parsed.data.requestedAmount!);
    const termMonths = parsed.data.termMonths!;
    const estimatedMonthlyDeduction = roundMoney(requestedAmount / termMonths);
    const estimatedPerPayrollDeduction = roundMoney(
      estimatedMonthlyDeduction / 2,
    );

    const status =
      GovernmentLoanAssistanceRequestStatus.PENDING_MANAGER_REVIEW;
    const created = await db.governmentLoanAssistanceRequest.create({
      data: {
        employeeId: employee.employeeId,
        agency: parsed.data.agency,
        requestedAmount,
        termMonths,
        estimatedMonthlyDeduction,
        estimatedPerPayrollDeduction,
        governmentIdSnapshot: governmentId.value,
        monthlySalarySnapshot: employeeDetails?.position?.monthlyRate ?? null,
        checklist: buildGovernmentLoanChecklist(
          status,
        ) as unknown as Prisma.InputJsonValue,
        employeeRemarks: parsed.data.employeeRemarks ?? null,
        status,
      },
      include: governmentLoanInclude,
    });

    revalidateRequestLayouts();
    await notifyManagersOfRequest({
      eventType: "GOVERNMENT_LOAN_REQUEST_SUBMITTED",
      title: "Government loan assistance submitted",
      message: `${employee.firstName} ${employee.lastName} submitted a ${getGovernmentLoanAgencyName(
        parsed.data.agency,
      )} assistance request.`,
      actorUserId: session.userId ?? null,
      entityType: "GovernmentLoanAssistanceRequest",
      entityId: created.id,
    });

    return {
      success: true,
      data: serializeGovernmentLoanAssistanceRequest(created),
    };
  } catch (error) {
    console.error("Error creating government loan assistance request:", error);
    return {
      success: false,
      error: "Failed to create government loan assistance request.",
    };
  }
}

export async function updateGovernmentLoanAssistanceStatus(
  input: GovernmentLoanStatusUpdatePayload,
): Promise<{
  success: boolean;
  data?: GovernmentLoanAssistanceRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to process government loan assistance requests.",
      };
    }

    const parsed = governmentLoanStatusUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid review data.",
      };
    }

    const existing = await getRequestForReview(parsed.data.id);
    if (!existing) {
      return { success: false, error: "Government loan assistance request not found." };
    }
    if (existing.employee.isArchived) {
      return {
        success: false,
        error: "The employee linked to this request is archived.",
      };
    }
    if (
      existing.status === GovernmentLoanAssistanceRequestStatus.RECORDED_IN_PAYROLL ||
      existing.status === GovernmentLoanAssistanceRequestStatus.DECLINED_BY_AGENCY ||
      existing.status === GovernmentLoanAssistanceRequestStatus.CANCELLED
    ) {
      return {
        success: false,
        error: "This request is already closed.",
      };
    }

    const nextStatus =
      parsed.data.status === "PROCESSING"
        ? GovernmentLoanAssistanceRequestStatus.PROCESSING
        : parsed.data.status === "APPROVED_BY_AGENCY"
          ? GovernmentLoanAssistanceRequestStatus.APPROVED_BY_AGENCY
          : GovernmentLoanAssistanceRequestStatus.DECLINED_BY_AGENCY;
    if (
      nextStatus === GovernmentLoanAssistanceRequestStatus.APPROVED_BY_AGENCY &&
      existing.status !== GovernmentLoanAssistanceRequestStatus.PROCESSING
    ) {
      return {
        success: false,
        error: "Mark the request Processing before recording agency approval.",
      };
    }
    const now = new Date();

    const updated = await db.governmentLoanAssistanceRequest.update({
      where: { id: parsed.data.id },
      data: {
        status: nextStatus,
        checklist: buildGovernmentLoanChecklist(
          nextStatus,
        ) as unknown as Prisma.InputJsonValue,
        managerRemarks: parsed.data.managerRemarks ?? null,
        agencyRemarks: parsed.data.agencyRemarks ?? null,
        reviewedByUserId: session.userId ?? null,
        reviewedAt: now,
        finalizedAt:
          nextStatus === GovernmentLoanAssistanceRequestStatus.DECLINED_BY_AGENCY
            ? now
            : null,
      },
      include: governmentLoanInclude,
    });

    revalidateRequestLayouts();
    await notifyEmployeeOfRequestDecision({
      eventType:
        nextStatus === GovernmentLoanAssistanceRequestStatus.PROCESSING
          ? "GOVERNMENT_LOAN_REQUEST_PROCESSING"
          : nextStatus === GovernmentLoanAssistanceRequestStatus.APPROVED_BY_AGENCY
            ? "GOVERNMENT_LOAN_REQUEST_APPROVED"
          : "GOVERNMENT_LOAN_REQUEST_DECLINED",
      title:
        nextStatus === GovernmentLoanAssistanceRequestStatus.PROCESSING
          ? "Government loan assistance processing"
          : nextStatus === GovernmentLoanAssistanceRequestStatus.APPROVED_BY_AGENCY
            ? "Government loan approved by agency"
          : "Government loan declined by agency",
      message:
        nextStatus === GovernmentLoanAssistanceRequestStatus.PROCESSING
          ? "Your government loan assistance request is now being processed."
          : nextStatus === GovernmentLoanAssistanceRequestStatus.APPROVED_BY_AGENCY
            ? "Your government loan was approved by the agency and is waiting for payroll recording."
          : "Your government loan request was declined by the agency.",
      actorUserId: session.userId ?? null,
      employeeId: updated.employee.employeeId,
      entityType: "GovernmentLoanAssistanceRequest",
      entityId: updated.id,
      linkHref: "/employee/requests",
    });

    return {
      success: true,
      data: serializeGovernmentLoanAssistanceRequest(updated),
    };
  } catch (error) {
    console.error("Error updating government loan assistance request:", error);
    return {
      success: false,
      error: "Failed to update government loan assistance request.",
    };
  }
}

export async function finalizeGovernmentLoanAssistanceRequest(
  input: GovernmentLoanFinalizePayload,
): Promise<{
  success: boolean;
  data?: GovernmentLoanAssistanceRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to finalize government loan assistance requests.",
      };
    }

    const parsed = governmentLoanFinalizeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid finalization data.",
      };
    }

    const existing = await getRequestForReview(parsed.data.id);
    if (!existing) {
      return { success: false, error: "Government loan assistance request not found." };
    }
    if (existing.employee.isArchived) {
      return {
        success: false,
        error: "The employee linked to this request is archived.",
      };
    }
    if (
      existing.status === GovernmentLoanAssistanceRequestStatus.RECORDED_IN_PAYROLL ||
      existing.status === GovernmentLoanAssistanceRequestStatus.DECLINED_BY_AGENCY ||
      existing.status === GovernmentLoanAssistanceRequestStatus.CANCELLED
    ) {
      return {
        success: false,
        error: "This request is already closed.",
      };
    }
    if (existing.status !== GovernmentLoanAssistanceRequestStatus.APPROVED_BY_AGENCY) {
      return {
        success: false,
        error: "Record agency approval before recording this loan in payroll.",
      };
    }

    const now = new Date();
    const approvedAmount = roundMoney(parsed.data.approvedAmount!);
    const approvedMonthlyPayment = roundMoney(parsed.data.approvedMonthlyPayment!);
    const installmentPerPayroll = roundMoney(approvedMonthlyPayment / 2);
    const repaymentStartDate = startOfZonedDay(parsed.data.repaymentStartDate!);
    const recordedStatus =
      GovernmentLoanAssistanceRequestStatus.RECORDED_IN_PAYROLL;

    try {
      const updated = await db.$transaction(async (tx) => {
        const fresh = await tx.governmentLoanAssistanceRequest.findUnique({
          where: { id: parsed.data.id },
          include: governmentLoanInclude,
        });
        if (!fresh) {
          throw new Error("Government loan assistance request not found.");
        }
        if (
          fresh.status ===
            GovernmentLoanAssistanceRequestStatus.RECORDED_IN_PAYROLL ||
          fresh.status ===
            GovernmentLoanAssistanceRequestStatus.DECLINED_BY_AGENCY ||
          fresh.status === GovernmentLoanAssistanceRequestStatus.CANCELLED
        ) {
          throw new Error("This request is already closed.");
        }
        if (fresh.status !== GovernmentLoanAssistanceRequestStatus.APPROVED_BY_AGENCY) {
          throw new Error(
            "Record agency approval before recording this loan in payroll.",
          );
        }

        const deductionType = await tx.deductionType.upsert({
          where: { code: GOVERNMENT_LOAN_DEDUCTION_CODE },
          create: {
            code: GOVERNMENT_LOAN_DEDUCTION_CODE,
            name: "Government Loan",
            description:
              "Government loan repayments recorded from approved SSS or Pag-IBIG assistance requests.",
            amountMode: DeductionAmountMode.FIXED,
            frequency: DeductionFrequency.INSTALLMENT,
            isActive: true,
            createdByUserId: session.userId ?? null,
            updatedByUserId: session.userId ?? null,
          },
          update: {
            name: "Government Loan",
            amountMode: DeductionAmountMode.FIXED,
            frequency: DeductionFrequency.INSTALLMENT,
            isActive: true,
            updatedByUserId: session.userId ?? null,
          },
          select: { id: true },
        });

        let assignmentEffectiveFrom = repaymentStartDate;
        for (let attempt = 0; attempt < 25; attempt += 1) {
          const duplicate = await tx.employeeDeductionAssignment.findFirst({
            where: {
              employeeId: fresh.employeeId,
              deductionTypeId: deductionType.id,
              effectiveFrom: assignmentEffectiveFrom,
            },
            select: { id: true },
          });
          if (!duplicate) break;
          assignmentEffectiveFrom = new Date(
            repaymentStartDate.getTime() + attempt + 1,
          );
        }

        const assignment = await tx.employeeDeductionAssignment.create({
          data: {
            employeeId: fresh.employeeId,
            deductionTypeId: deductionType.id,
            effectiveFrom: assignmentEffectiveFrom,
            installmentTotal: approvedAmount,
            installmentPerPayroll,
            remainingBalance: approvedAmount,
            workflowStatus: EmployeeDeductionWorkflowStatus.APPROVED,
            status: EmployeeDeductionAssignmentStatus.ACTIVE,
            reason: `${getGovernmentLoanAgencyName(
              fresh.agency,
            )} approved by agency. Monthly payment: ${approvedMonthlyPayment.toFixed(
              2,
            )}.`,
            assignedByUserId: session.userId ?? null,
            updatedByUserId: session.userId ?? null,
            submittedAt: now,
            reviewedByUserId: session.userId ?? null,
            reviewedAt: now,
            reviewRemarks:
              "Created automatically from approved government loan assistance request.",
          },
          select: { id: true },
        });

        return tx.governmentLoanAssistanceRequest.update({
          where: { id: parsed.data.id },
          data: {
            status: recordedStatus,
            checklist: buildGovernmentLoanChecklist(
              recordedStatus,
            ) as unknown as Prisma.InputJsonValue,
            managerRemarks: parsed.data.managerRemarks ?? null,
            agencyRemarks: parsed.data.agencyRemarks ?? null,
            approvedAmount,
            approvedMonthlyPayment,
            repaymentStartDate,
            reviewedByUserId: session.userId ?? null,
            reviewedAt: now,
            finalizedAt: now,
            deductionAssignmentId: assignment.id,
          },
          include: governmentLoanInclude,
        });
      });

      revalidateRequestLayouts();
      await notifyEmployeeOfRequestDecision({
        eventType: "GOVERNMENT_LOAN_REQUEST_RECORDED",
        title: "Government loan recorded in payroll",
        message:
          "Your approved government loan has been recorded as a payroll deduction.",
        actorUserId: session.userId ?? null,
        employeeId: updated.employee.employeeId,
        entityType: "GovernmentLoanAssistanceRequest",
        entityId: updated.id,
        linkHref: "/employee/deductions",
      });

      return {
        success: true,
        data: serializeGovernmentLoanAssistanceRequest(updated),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return {
          success: false,
          error:
            "A government loan deduction already exists for this employee on the selected start date. Try again.",
        };
      }
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      throw error;
    }
  } catch (error) {
    console.error("Error finalizing government loan assistance request:", error);
    return {
      success: false,
      error: "Failed to finalize government loan assistance request.",
    };
  }
}
