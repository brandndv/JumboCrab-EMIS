import "server-only";

import { cache } from "react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RawSessionData } from "@/lib/session-shared";
import { getHomePathForRole, normalizeRole } from "@/lib/rbac";

const toRateNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

export const getCurrentPlainSession = cache(
  async (): Promise<RawSessionData | null> => {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return null;
    }

    const user = await db.user.findUnique({
      where: { userId: session.userId },
      include: {
        employee: {
          include: {
            position: {
              select: {
                name: true,
                dailyRate: true,
              },
            },
            department: { select: { name: true } },
            topAccount: {
              select: {
                userId: true,
                role: true,
                isDisabled: true,
              },
            },
          },
        },
        employeeProfile: {
          select: {
            employeeId: true,
            user: {
              select: {
                userId: true,
                role: true,
                isDisabled: true,
              },
            },
          },
        },
      },
    });

    const role = normalizeRole(user?.role);
    if (!user || !role) {
      return null;
    }

    const employeeTargetRole = normalizeRole(user.employee?.topAccount?.role);
    const employeeSwitchTarget =
      role === "employee" &&
      user.employee?.topAccount &&
      !user.employee.topAccount.isDisabled &&
      employeeTargetRole
        ? {
            userId: user.employee.topAccount.userId,
            role: employeeTargetRole,
            label: `Switch to ${employeeTargetRole === "manager" ? "Manager" : "Supervisor"}`,
            href: getHomePathForRole(employeeTargetRole),
          }
        : null;

    const topTargetRole = normalizeRole(user.employeeProfile?.user?.role);
    const topSwitchTarget =
      (role === "manager" || role === "supervisor") &&
      user.employeeProfile?.user &&
      !user.employeeProfile.user.isDisabled &&
      topTargetRole === "employee"
        ? {
            userId: user.employeeProfile.user.userId,
            role: topTargetRole,
            label: "Switch to Employee",
            href: getHomePathForRole(topTargetRole),
          }
        : null;

    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
      isDisabled: user.isDisabled,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      employee: user.employee
        ? {
            ...user.employee,
            dailyRate: toRateNumber(user.employee.position?.dailyRate),
            position: user.employee.position?.name ?? null,
            department: user.employee.department?.name ?? null,
            topAccount: undefined,
          }
        : null,
      switchAccount: employeeSwitchTarget ?? topSwitchTarget,
      isLoggedIn: true,
    };
  },
);
