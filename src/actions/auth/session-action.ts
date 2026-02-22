"use server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function fetchSession() {
  try {
    const session = await getSession();

    if (!session.userId) {
      return {
        success: true,
        session: { isLoggedIn: false },
      };
    }

    // Fetch the user with employee data
    const user = await db.user.findUnique({
      where: { userId: session.userId },
      include: {
        employee: {
          include: {
            position: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    const normalizedEmployee = user.employee
      ? {
          ...user.employee,
          position: user.employee.position?.name ?? null,
          department: user.employee.department?.name ?? null,
        }
      : null;

    const plainSession = {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
      employee: normalizedEmployee,
      isLoggedIn: true,
    };

    return {
      success: true,
      session: plainSession,
    };
  } catch (error) {
    console.error("Failed to fetch session:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to retrieve the current session",
    };
  }
}
