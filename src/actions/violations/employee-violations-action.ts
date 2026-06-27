"use server";

import {
  NotificationEventType,
  NotificationModule,
  NotificationSeverity,
  Roles,
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAndDispatchNotification } from "@/lib/notifications";
import {
  EMPLOYEE_VIOLATION_STATUS,
  FIXED_STRIKE_POINTS_PER_VIOLATION,
  appendMaxStrikeNote,
  canDraftViolations,
  canReviewViolations,
  countApprovedCountedStrikesForType,
  employeeViolationInclude,
  hasAppealSubmittedAtColumn,
  getViolationMaxStrikesPerEmployee,
  normalizeMaxStrikesPerEmployee,
  parseDateInput,
  serializeViolation,
} from "./violations-shared";
import type { ViolationRow } from "./types";

const APPEAL_STEP = {
  SECURED: "SECURED",
  FILLED: "FILLED",
  SUBMITTED_TO_MANAGER: "SUBMITTED_TO_MANAGER",
} as const;

type AppealStep = (typeof APPEAL_STEP)[keyof typeof APPEAL_STEP];

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
        ? EMPLOYEE_VIOLATION_STATUS.PENDING_EMPLOYEE
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
          user: {
            select: {
              role: true,
            },
          },
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
    if (employee.user?.role !== Roles.Employee) {
      return {
        success: false,
        error: "Violations can only be assigned to employee accounts.",
      };
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

    if (createdStatus === EMPLOYEE_VIOLATION_STATUS.PENDING_EMPLOYEE) {
      await createAndDispatchNotification({
        eventType: NotificationEventType.VIOLATION_ACKNOWLEDGEMENT_REQUIRED,
        module: NotificationModule.VIOLATIONS,
        title: "Violation acknowledgement required",
        message:
          "A supervisor submitted a violation record that requires your acknowledgement and appeal paper submission.",
        severity: NotificationSeverity.WARNING,
        actorUserId: session.userId ?? null,
        entityType: "EmployeeViolation",
        entityId: created.id,
        linkHref: "/employee/violations",
        recipients: {
          employeeIds: [created.employeeId],
        },
        emailEligible: true,
      });
    } else {
      await createAndDispatchNotification({
        eventType: NotificationEventType.VIOLATION_ACKNOWLEDGEMENT_REQUIRED,
        module: NotificationModule.VIOLATIONS,
        title: "Violation acknowledgement required",
        message: "A new violation record requires your acknowledgement.",
        severity: NotificationSeverity.WARNING,
        actorUserId: session.userId ?? null,
        entityType: "EmployeeViolation",
        entityId: created.id,
        linkHref: "/employee/violations",
        recipients: {
          employeeIds: [created.employeeId],
        },
        emailEligible: true,
      });
    }

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
      select: {
        id: true,
        status: true,
        employee: { select: { userId: true } },
      },
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
      if (target.status !== EMPLOYEE_VIOLATION_STATUS.PENDING_EMPLOYEE) {
        return {
          success: false,
          error: "Only pending employee violations can be acknowledged.",
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

    if (Boolean(input.isAcknowledged)) {
      await createAndDispatchNotification({
        eventType: NotificationEventType.VIOLATION_ACKNOWLEDGED,
        module: NotificationModule.VIOLATIONS,
        title: "Violation acknowledged",
        message: "An employee acknowledged a violation record.",
        severity: NotificationSeverity.SUCCESS,
        actorUserId: session.userId ?? null,
        entityType: "EmployeeViolation",
        entityId: updated.id,
        linkHref: "/manager/violations",
        recipients: {
          roles: [Roles.Admin, Roles.Manager],
        },
        emailEligible: false,
      });
    }

    return { success: true, data: serializeViolation(updated) };
  } catch (error) {
    console.error("Error updating violation acknowledgement:", error);
    return { success: false, error: "Failed to update acknowledgement." };
  }
}

export async function setEmployeeViolationAppealStep(input: {
  id: string;
  step: AppealStep;
  completed: boolean;
}): Promise<{
  success: boolean;
  data?: ViolationRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || session.role !== Roles.Employee) {
      return {
        success: false,
        error: "You are not allowed to update appeal paper steps.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    const step =
      typeof input.step === "string" ? input.step.trim().toUpperCase() : "";
    const completed = Boolean(input.completed);
    if (!id) return { success: false, error: "id is required" };
    if (
      step !== APPEAL_STEP.SECURED &&
      step !== APPEAL_STEP.FILLED &&
      step !== APPEAL_STEP.SUBMITTED_TO_MANAGER
    ) {
      return { success: false, error: "Invalid appeal paper step." };
    }

    const target = await db.employeeViolation.findUnique({
      where: { id },
      include: {
        ...employeeViolationInclude,
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            img: true,
            userId: true,
          },
        },
      },
    });
    if (!target) return { success: false, error: "Violation not found" };
    if (!session.userId || target.employee.userId !== session.userId) {
      return {
        success: false,
        error: "You can only update your own appeal paper steps.",
      };
    }
    if (target.status !== EMPLOYEE_VIOLATION_STATUS.PENDING_EMPLOYEE) {
      return {
        success: false,
        error: "Only pending employee violations can update appeal paper steps.",
      };
    }
    if (!target.isAcknowledged) {
      return {
        success: false,
        error: "Acknowledge the violation before updating appeal paper steps.",
      };
    }

    const now = new Date();
    const data: {
      appealPaperSecuredAt?: Date | null;
      appealPaperFilledAt?: Date | null;
      appealPaperSubmittedToManagerAt?: Date | null;
    } = {};

    if (step === APPEAL_STEP.SECURED) {
      data.appealPaperSecuredAt = completed
        ? (target.appealPaperSecuredAt ?? now)
        : null;
      if (!completed) {
        data.appealPaperFilledAt = null;
        data.appealPaperSubmittedToManagerAt = null;
      }
    }

    if (step === APPEAL_STEP.FILLED) {
      if (completed && !target.appealPaperSecuredAt) {
        return {
          success: false,
          error: "Secure the appeal paper before marking it filled.",
        };
      }
      data.appealPaperFilledAt = completed
        ? (target.appealPaperFilledAt ?? now)
        : null;
      if (!completed) {
        data.appealPaperSubmittedToManagerAt = null;
      }
    }

    if (step === APPEAL_STEP.SUBMITTED_TO_MANAGER) {
      if (
        completed &&
        (!target.appealPaperSecuredAt || !target.appealPaperFilledAt)
      ) {
        return {
          success: false,
          error: "Fill the appeal paper before marking it submitted to manager.",
        };
      }
      data.appealPaperSubmittedToManagerAt = completed
        ? (target.appealPaperSubmittedToManagerAt ?? now)
        : null;
    }

    const updated = await db.employeeViolation.update({
      where: { id },
      data,
      include: employeeViolationInclude,
    });

    return { success: true, data: serializeViolation(updated) };
  } catch (error) {
    console.error("Error updating violation appeal paper step:", error);
    return {
      success: false,
      error: "Failed to update appeal paper step.",
    };
  }
}

export async function setEmployeeViolationAppealSubmitted(input: {
  id: string;
}): Promise<{
  success: boolean;
  data?: ViolationRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || session.role !== Roles.Employee) {
      return {
        success: false,
        error: "You are not allowed to submit an appeal marker.",
      };
    }

    const id = typeof input.id === "string" ? input.id.trim() : "";
    if (!id) {
      return { success: false, error: "id is required" };
    }
    if (!(await hasAppealSubmittedAtColumn())) {
      return {
        success: false,
        error:
          "Violation appeal tracking is not ready yet. Run Prisma migration, regenerate client, then restart dev server.",
      };
    }

    const target = await db.employeeViolation.findUnique({
      where: { id },
      include: {
        ...employeeViolationInclude,
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            img: true,
            userId: true,
          },
        },
      },
    });
    if (!target) {
      return { success: false, error: "Violation not found" };
    }
    if (!session.userId || target.employee.userId !== session.userId) {
      return {
        success: false,
        error: "You can only submit an appeal marker for your own record.",
      };
    }
    if (target.status !== EMPLOYEE_VIOLATION_STATUS.PENDING_EMPLOYEE) {
      return {
        success: false,
        error: "Only pending employee violations can be marked as appealed.",
      };
    }
    if (!target.isAcknowledged) {
      return {
        success: false,
        error: "Acknowledge the violation before marking appeal paper submitted.",
      };
    }
    if (
      !target.appealPaperSecuredAt ||
      !target.appealPaperFilledAt ||
      !target.appealPaperSubmittedToManagerAt
    ) {
      return {
        success: false,
        error: "Complete all appeal paper steps before sending to manager review.",
      };
    }

    const existingAppealRows = await db.$queryRaw<
      Array<{ appealSubmittedAt: Date | null }>
    >`
      SELECT "appealSubmittedAt"
      FROM "EmployeeViolation"
      WHERE "id" = ${id}
      LIMIT 1
    `;
    const existingAppealSubmittedAt =
      existingAppealRows[0]?.appealSubmittedAt ?? null;

    if (existingAppealSubmittedAt) {
      const updated = await db.employeeViolation.update({
        where: { id },
        data: {
          status: EMPLOYEE_VIOLATION_STATUS.PENDING_MANAGER_REVIEW,
          submittedAt: target.submittedAt ?? new Date(),
        },
        include: employeeViolationInclude,
      });
      return {
        success: true,
        data: serializeViolation(updated),
      };
    }

    const submittedAt = new Date();
    await db.$executeRaw`
      UPDATE "EmployeeViolation"
      SET
        "appealSubmittedAt" = ${submittedAt},
        "submittedAt" = ${submittedAt},
        "status" = ${EMPLOYEE_VIOLATION_STATUS.PENDING_MANAGER_REVIEW}::"EmployeeViolationStatus"
      WHERE "id" = ${id}
    `;

    const updated = await db.employeeViolation.findUnique({
      where: { id },
      include: employeeViolationInclude,
    });
    if (!updated) {
      return { success: false, error: "Violation not found" };
    }

    await createAndDispatchNotification({
      eventType: NotificationEventType.VIOLATION_APPEAL_PAPER_SUBMITTED,
      module: NotificationModule.VIOLATIONS,
      title: "Violation appeal paper submitted",
      message:
        "An employee marked a physical violation appeal paper as submitted.",
      severity: NotificationSeverity.INFO,
      actorUserId: session.userId ?? null,
      entityType: "EmployeeViolation",
      entityId: updated.id,
      linkHref: "/manager/violations",
      recipients: {
        roles: [Roles.Admin, Roles.Manager, Roles.GeneralManager],
      },
      emailEligible: false,
    });

    return {
      success: true,
      data: {
        ...serializeViolation(updated),
        appealSubmittedAt: submittedAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("Error submitting violation appeal marker:", error);
    return {
      success: false,
      error: "Failed to submit violation appeal marker.",
    };
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
      return { success: false, error: "Violation record not found" };
    }
    if (existing.status !== EMPLOYEE_VIOLATION_STATUS.PENDING_MANAGER_REVIEW) {
      return {
        success: false,
        error: "Only violations with submitted appeal papers can be reviewed",
      };
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
          error: "Violation definition not found for this record.",
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

    if (decision === EMPLOYEE_VIOLATION_STATUS.APPROVED) {
      await createAndDispatchNotification({
        eventType: NotificationEventType.VIOLATION_APPROVED,
        module: NotificationModule.VIOLATIONS,
        title: "Violation approved",
        message: "A violation record was approved and requires employee acknowledgement.",
        severity: NotificationSeverity.WARNING,
        actorUserId: session.userId ?? null,
        entityType: "EmployeeViolation",
        entityId: reviewed.id,
        linkHref: "/employee/violations",
        recipients: {
          employeeIds: [reviewed.employeeId],
        },
        emailEligible: true,
      });
    } else {
      const rejectionMessage = normalizedReviewRemarks
        ? `A violation record was rejected during review. Remarks: ${normalizedReviewRemarks}`
        : "A violation record was rejected during review.";

      await createAndDispatchNotification({
        eventType: NotificationEventType.VIOLATION_REJECTED,
        module: NotificationModule.VIOLATIONS,
        title: "Violation rejected",
        message: rejectionMessage,
        severity: NotificationSeverity.WARNING,
        actorUserId: session.userId ?? null,
        entityType: "EmployeeViolation",
        entityId: reviewed.id,
        linkHref: "/employee/violations",
        recipients: {
          employeeIds: [reviewed.employeeId],
        },
        emailEligible: true,
      });
    }

    return { success: true, data: serializeViolation(reviewed) };
  } catch (error) {
    console.error("Error reviewing employee violation:", error);
    return { success: false, error: "Failed to review violation." };
  }
}
