"use server";

import { Roles } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  EMPLOYEE_VIOLATION_STATUS,
  FIXED_STRIKE_POINTS_PER_VIOLATION,
  appendMaxStrikeNote,
  canDraftViolations,
  canReviewViolations,
  countApprovedCountedStrikesForType,
  employeeViolationInclude,
  getViolationMaxStrikesPerEmployee,
  normalizeMaxStrikesPerEmployee,
  parseDateInput,
  serializeViolation,
} from "./violations-shared";
import type { ViolationRow } from "./types";

export async function createEmployeeViolation(input: {
  employeeId: string;
  violationId: string;
  violationDate: string;
  remarks?: string | null;
  isAcknowledged?: boolean;
  voidedAt?: string | null;
  voidReason?: string | null;
}): Promise<{
  success: boolean;
  data?: ViolationRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canDraftViolations(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create employee violations.",
      };
    }

    const employeeId =
      typeof input.employeeId === "string" ? input.employeeId.trim() : "";
    const violationId =
      typeof input.violationId === "string" ? input.violationId.trim() : "";
    const violationDateRaw =
      typeof input.violationDate === "string" ? input.violationDate.trim() : "";
    const remarks =
      typeof input.remarks === "string" && input.remarks.trim()
        ? input.remarks.trim()
        : null;
    const isAcknowledged = Boolean(input.isAcknowledged);
    const voidedAtRaw =
      typeof input.voidedAt === "string" ? input.voidedAt.trim() : "";
    const voidedAt =
      voidedAtRaw.length > 0 ? parseDateInput(voidedAtRaw) : null;
    const voidReason =
      typeof input.voidReason === "string" && input.voidReason.trim()
        ? input.voidReason.trim()
        : null;
    const acknowledgedAt = isAcknowledged ? new Date() : null;
    const createdStatus =
      session.role === Roles.Supervisor
        ? EMPLOYEE_VIOLATION_STATUS.DRAFT
        : EMPLOYEE_VIOLATION_STATUS.APPROVED;
    const createdAtNow = new Date();

    if (!employeeId) return { success: false, error: "employeeId is required" };
    if (!violationId)
      return { success: false, error: "violationId is required" };
    if (!violationDateRaw) {
      return { success: false, error: "violationDate is required" };
    }

    const violationDate = parseDateInput(violationDateRaw);
    if (!violationDate) {
      return { success: false, error: "Invalid violation date" };
    }

    const [employee, violation] = await Promise.all([
      db.employee.findUnique({
        where: { employeeId },
        select: {
          employeeId: true,
          isArchived: true,
          supervisorUserId: true,
        },
      }),
      db.violation.findUnique({
        where: { violationId },
        select: {
          violationId: true,
          defaultStrikePoints: true,
          isActive: true,
        },
      }),
    ]);

    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee not found" };
    }
    if (
      session.role === Roles.Supervisor &&
      employee.supervisorUserId !== session.userId
    ) {
      return {
        success: false,
        error: "You can only create violations for your subordinates.",
      };
    }
    if (!violation) {
      return { success: false, error: "Violation definition not found" };
    }
    if (!violation.isActive) {
      return {
        success: false,
        error: "Violation definition is inactive and cannot be assigned",
      };
    }
    if (voidedAtRaw.length > 0 && !voidedAt) {
      return { success: false, error: "Invalid voidedAt date" };
    }

    let strikePointsSnapshot = FIXED_STRIKE_POINTS_PER_VIOLATION;
    let isCountedForStrike = false;
    let reviewRemarks =
      createdStatus === EMPLOYEE_VIOLATION_STATUS.APPROVED
        ? "Directly approved by management"
        : null;

    if (createdStatus === EMPLOYEE_VIOLATION_STATUS.APPROVED) {
      const countedSoFar = await countApprovedCountedStrikesForType(
        employeeId,
        violationId,
      );
      const maxStrikes = normalizeMaxStrikesPerEmployee(
        await getViolationMaxStrikesPerEmployee(violationId),
      );
      if (countedSoFar >= maxStrikes) {
        isCountedForStrike = false;
        strikePointsSnapshot = 0;
        reviewRemarks = appendMaxStrikeNote(reviewRemarks);
      } else {
        isCountedForStrike = true;
      }
    }

    const created = await db.employeeViolation.create({
      data: {
        employeeId,
        violationId,
        violationDate,
        strikePointsSnapshot,
        status: createdStatus,
        draftedById: session.userId ?? null,
        submittedAt:
          createdStatus === EMPLOYEE_VIOLATION_STATUS.APPROVED
            ? createdAtNow
            : null,
        reviewedById:
          createdStatus === EMPLOYEE_VIOLATION_STATUS.APPROVED
            ? (session.userId ?? null)
            : null,
        reviewedAt:
          createdStatus === EMPLOYEE_VIOLATION_STATUS.APPROVED
            ? createdAtNow
            : null,
        reviewRemarks,
        isAcknowledged,
        acknowledgedAt,
        isCountedForStrike,
        voidedAt,
        voidReason,
        remarks,
      },
      include: employeeViolationInclude,
    });

    return { success: true, data: serializeViolation(created) };
  } catch (error) {
    console.error("Error creating employee violation:", error);
    return { success: false, error: "Failed to create violation." };
  }
}

export async function setEmployeeViolationAcknowledged(input: {
  id: string;
  isAcknowledged: boolean;
}): Promise<{
  success: boolean;
  data?: ViolationRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return { success: false, error: "Not authenticated." };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) {
      return { success: false, error: "id is required" };
    }

    const target = await db.employeeViolation.findUnique({
      where: { id },
      select: { id: true, employee: { select: { userId: true } } },
    });
    if (!target) {
      return { success: false, error: "Violation not found" };
    }

    if (session.role === Roles.Employee) {
      if (!session.userId || target.employee.userId !== session.userId) {
        return {
          success: false,
          error: "You can only acknowledge your own records.",
        };
      }
    } else if (!canReviewViolations(session.role)) {
      return {
        success: false,
        error: "You are not allowed to update acknowledgement.",
      };
    }

    const updated = await db.employeeViolation.update({
      where: { id },
      data: {
        isAcknowledged: Boolean(input.isAcknowledged),
        acknowledgedAt: Boolean(input.isAcknowledged) ? new Date() : null,
      },
      include: employeeViolationInclude,
    });

    return { success: true, data: serializeViolation(updated) };
  } catch (error) {
    console.error("Error updating violation acknowledgement:", error);
    return { success: false, error: "Failed to update acknowledgement." };
  }
}

export async function reviewEmployeeViolation(input: {
  id: string;
  decision: "APPROVED" | "REJECTED";
  reviewRemarks?: string | null;
}): Promise<{
  success: boolean;
  data?: ViolationRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canReviewViolations(session.role)) {
      return {
        success: false,
        error: "You are not allowed to review violations.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    const decision = input.decision;
    const reviewRemarks =
      typeof input.reviewRemarks === "string" && input.reviewRemarks.trim()
        ? input.reviewRemarks.trim()
        : null;

    if (!id) return { success: false, error: "id is required" };
    if (
      decision !== EMPLOYEE_VIOLATION_STATUS.APPROVED &&
      decision !== EMPLOYEE_VIOLATION_STATUS.REJECTED
    ) {
      return { success: false, error: "decision must be APPROVED or REJECTED" };
    }

    const existing = await db.employeeViolation.findUnique({
      where: { id },
      select: { id: true, status: true, employeeId: true, violationId: true },
    });
    if (!existing) {
      return { success: false, error: "Violation draft not found" };
    }
    if (existing.status !== EMPLOYEE_VIOLATION_STATUS.DRAFT) {
      return { success: false, error: "Only drafts can be reviewed" };
    }

    let isCountedForStrike = false;
    let strikePointsSnapshot = 0;
    let normalizedReviewRemarks = reviewRemarks;

    if (decision === EMPLOYEE_VIOLATION_STATUS.APPROVED) {
      const definition = await db.violation.findUnique({
        where: { violationId: existing.violationId },
        select: { violationId: true },
      });
      if (!definition) {
        return {
          success: false,
          error: "Violation definition not found for this draft.",
        };
      }

      const countedSoFar = await countApprovedCountedStrikesForType(
        existing.employeeId,
        existing.violationId,
      );
      const maxStrikes = normalizeMaxStrikesPerEmployee(
        await getViolationMaxStrikesPerEmployee(existing.violationId),
      );

      strikePointsSnapshot = FIXED_STRIKE_POINTS_PER_VIOLATION;
      if (countedSoFar >= maxStrikes) {
        isCountedForStrike = false;
        strikePointsSnapshot = 0;
        normalizedReviewRemarks = appendMaxStrikeNote(normalizedReviewRemarks);
      } else {
        isCountedForStrike = true;
      }
    }

    const reviewed = await db.employeeViolation.update({
      where: { id },
      data: {
        status: decision,
        reviewedById: session.userId ?? null,
        reviewedAt: new Date(),
        reviewRemarks: normalizedReviewRemarks,
        submittedAt: new Date(),
        strikePointsSnapshot,
        isCountedForStrike,
      },
      include: employeeViolationInclude,
    });

    return { success: true, data: serializeViolation(reviewed) };
  } catch (error) {
    console.error("Error reviewing employee violation:", error);
    return { success: false, error: "Failed to review violation." };
  }
}
