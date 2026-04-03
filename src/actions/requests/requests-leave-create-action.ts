"use server";

import { LeaveRequestStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { leaveRequestSchema } from "@/lib/validations/requests";
import {
  canCreateEmployeeRequests,
  employeeRequestSelect,
  getEmployeeForSession,
  revalidateRequestLayouts,
  reviewedBySelect,
  serializeLeaveRequest,
} from "./requests-shared";
import type { LeaveRequestPayload, LeaveRequestRow } from "./types";

export async function createLeaveRequest(
  input: LeaveRequestPayload,
): Promise<{
  success: boolean;
  data?: LeaveRequestRow;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !canCreateEmployeeRequests(session.role)) {
      return {
        success: false,
        error: "You are not allowed to create leave requests.",
      };
    }
    if (!session.userId) {
      return { success: false, error: "Employee session is invalid." };
    }

    const parsed = leaveRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid leave request data.",
      };
    }

    const employee = await getEmployeeForSession(session.userId);
    if (!employee || employee.isArchived) {
      return { success: false, error: "Employee record not found." };
    }

    const overlapping = await db.leaveRequest.findFirst({
      where: {
        employeeId: employee.employeeId,
        status: {
          in: [LeaveRequestStatus.PENDING_MANAGER, LeaveRequestStatus.APPROVED],
        },
        startDate: {
          lte: parsed.data.endDate!,
        },
        endDate: {
          gte: parsed.data.startDate!,
        },
      },
      select: { id: true },
    });

    if (overlapping) {
      return {
        success: false,
        error:
          "There is already a pending or approved leave request overlapping these dates.",
      };
    }

    const created = await db.leaveRequest.create({
      data: {
        employeeId: employee.employeeId,
        leaveType: parsed.data.leaveType,
        startDate: parsed.data.startDate!,
        endDate: parsed.data.endDate!,
        reason: parsed.data.reason ?? null,
        status: LeaveRequestStatus.PENDING_MANAGER,
      },
      include: {
        employee: { select: employeeRequestSelect },
        reviewedBy: { select: reviewedBySelect },
        attendances: {
          select: {
            workDate: true,
            isPaidLeave: true,
          },
        },
      },
    });

    revalidateRequestLayouts();
    return { success: true, data: serializeLeaveRequest(created) };
  } catch (error) {
    console.error("Error creating leave request:", error);
    return { success: false, error: "Failed to create leave request." };
  }
}
