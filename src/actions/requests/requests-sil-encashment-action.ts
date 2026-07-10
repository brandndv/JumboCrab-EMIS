"use server";

import {
  LeaveCreditLedgerEntryType,
  LeaveRequestStatus,
  Prisma,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  silEncashmentRequestSchema,
} from "@/lib/validations/requests";
import {
  canCreateEmployeeRequests,
  canReviewRequests,
  employeeRequestSelect,
  getEmployeeForSession,
  revalidateRequestLayouts,
  reviewedBySelect,
  serializeSilEncashmentRequest,
} from "./requests-shared";
import { getEmployeeLeaveCredits } from "./requests-leave-credit-shared";
import {
  notifyEmployeeOfRequestDecision,
  notifyManagersOfRequest,
} from "./requests-notifications";
import type {
  SilEncashmentRequestPayload,
  SilEncashmentRequestRow,
  SilEncashmentReviewPayload,
} from "./types";

const silEncashmentInclude = {
  employee: { select: employeeRequestSelect },
  reviewedBy: { select: reviewedBySelect },
} satisfies Prisma.SilEncashmentRequestInclude;

export async function listSilEncashmentRequests(input?: {
  statuses?: LeaveRequestStatus[] | null;
  employeeId?: string | null;
  limit?: number | null;
}): Promise<{
  success: boolean;
  data?: SilEncashmentRequestRow[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) return { success: false, error: "Not authenticated." };

    const where: Prisma.SilEncashmentRequestWhereInput = {};
    if (canCreateEmployeeRequests(session.role)) {
      if (!session.userId) return { success: false, error: "Employee session is invalid." };
      const employee = await getEmployeeForSession(session.userId);
      if (!employee || employee.isArchived) {
        return { success: false, error: "Employee record not found." };
      }
      where.employeeId = employee.employeeId;
    } else if (canReviewRequests(session.role)) {
      if (input?.employeeId?.trim()) where.employeeId = input.employeeId.trim();
    } else {
      return { success: false, error: "You are not allowed to view SIL encashment requests." };
    }

    if (Array.isArray(input?.statuses) && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const rows = await db.silEncashmentRequest.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { submittedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: Math.max(1, Math.min(input?.limit ?? 200, 500)),
      include: silEncashmentInclude,
    });

    return { success: true, data: rows.map(serializeSilEncashmentRequest) };
  } catch (error) {
    console.error("Error listing SIL encashment requests:", error);
    return { success: false, error: "Failed to load SIL encashment requests." };
  }
}

export async function createSilEncashmentRequest(
  input: SilEncashmentRequestPayload,
): Promise<{
  success: boolean;
  data?: SilEncashmentRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return { success: false, error: "You are not allowed to create SIL encashment requests." };
    }
    if (!session.userId) return { success: false, error: "Employee session is invalid." };

    const parsed = silEncashmentRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid SIL encashment request.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const details = await db.employee.findUnique({
      where: { employeeId: employee.employeeId },
      select: { employeeId: true, startDate: true, isArchived: true },
    });
    if (!details || details.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const credits = await getEmployeeLeaveCredits({
      employeeId: details.employeeId,
      employeeStartDate: details.startDate,
      createdByUserId: session.userId ?? null,
    });
    if (credits.sil.balance < parsed.data.days) {
      return {
        success: false,
        error: `Only ${credits.sil.balance} SIL credit(s) available for encashment.`,
      };
    }

    const created = await db.silEncashmentRequest.create({
      data: {
        employeeId: details.employeeId,
        days: parsed.data.days,
        employeeRemarks: parsed.data.employeeRemarks ?? null,
      },
      include: silEncashmentInclude,
    });

    revalidateRequestLayouts();
    await notifyManagersOfRequest({
      eventType: "LEAVE_REQUEST_SUBMITTED",
      title: "SIL encashment submitted",
      message: `${employee.firstName} ${employee.lastName} requested ${parsed.data.days} SIL credit(s) for encashment.`,
      actorUserId: session.userId ?? null,
      entityType: "SilEncashmentRequest",
      entityId: created.id,
    });

    return { success: true, data: serializeSilEncashmentRequest(created) };
  } catch (error) {
    console.error("Error creating SIL encashment request:", error);
    return { success: false, error: "Failed to create SIL encashment request." };
  }
}

export async function reviewSilEncashmentRequest(
  input: SilEncashmentReviewPayload,
): Promise<{
  success: boolean;
  data?: SilEncashmentRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewRequests(session.role)) {
      return { success: false, error: "You are not allowed to review SIL encashment requests." };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) return { success: false, error: "Request is required." };

    const decision = input.decision === "APPROVED" ? "APPROVED" : "REJECTED";
    const now = new Date();

    const updated = await db.$transaction(async (tx) => {
      const existing = await tx.silEncashmentRequest.findUnique({
        where: { id },
        include: silEncashmentInclude,
      });
      if (!existing) throw new Error("SIL encashment request not found.");
      if (existing.status !== LeaveRequestStatus.PENDING_MANAGER) {
        throw new Error("This SIL encashment request is already reviewed.");
      }

      const employee = await tx.employee.findUnique({
        where: { employeeId: existing.employeeId },
        select: { startDate: true, isArchived: true },
      });
      if (!employee || employee.isArchived) {
        throw new Error("The employee linked to this request is archived.");
      }

      let ledgerEntryId: string | null = null;
      if (decision === "APPROVED") {
        const credits = await getEmployeeLeaveCredits({
          client: tx,
          employeeId: existing.employeeId,
          employeeStartDate: employee.startDate,
          referenceDate: now,
          createdByUserId: session.userId ?? null,
        });
        if (credits.sil.balance < existing.days) {
          throw new Error(
            `Only ${credits.sil.balance} SIL credit(s) available for encashment.`,
          );
        }
        const ledger = await tx.employeeLeaveCreditLedger.create({
          data: {
            employeeId: existing.employeeId,
            leaveType: "SIL",
            entryType: LeaveCreditLedgerEntryType.ENCASHMENT,
            amount: -existing.days,
            balanceBefore: credits.sil.balance,
            balanceAfter: credits.sil.balance - existing.days,
            effectiveDate: now,
            cycleStartDate: credits.sil.cycleStartDate,
            notes: `Approved SIL encashment request for ${existing.days} day(s).`,
            createdByUserId: session.userId ?? null,
          },
        });
        ledgerEntryId = ledger.id;
      }

      return tx.silEncashmentRequest.update({
        where: { id },
        data: {
          status:
            decision === "APPROVED"
              ? LeaveRequestStatus.APPROVED
              : LeaveRequestStatus.REJECTED,
          managerRemarks: input.managerRemarks?.trim() || null,
          reviewedByUserId: session.userId ?? null,
          reviewedAt: now,
          ledgerEntryId,
        },
        include: silEncashmentInclude,
      });
    });

    revalidateRequestLayouts();
    await notifyEmployeeOfRequestDecision({
      eventType:
        decision === "APPROVED"
          ? "LEAVE_REQUEST_APPROVED"
          : "LEAVE_REQUEST_REJECTED",
      title:
        decision === "APPROVED"
          ? "SIL encashment approved"
          : "SIL encashment rejected",
      message:
        decision === "APPROVED"
          ? "Your SIL encashment request was approved."
          : "Your SIL encashment request was rejected.",
      actorUserId: session.userId ?? null,
      employeeId: updated.employeeId,
      entityType: "SilEncashmentRequest",
      entityId: updated.id,
      linkHref: "/employee/requests/leave",
    });

    return { success: true, data: serializeSilEncashmentRequest(updated) };
  } catch (error) {
    console.error("Error reviewing SIL encashment request:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to review SIL encashment request.",
    };
  }
}
