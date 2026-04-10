import "server-only";

import { cache } from "react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { RawSessionData } from "@/lib/session-shared";
import { normalizeRole } from "@/lib/rbac";

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
          },
        },
      },
    });

    if (!user || !normalizeRole(user.role)) {
      return null;
    }

    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
      isDisabled: user.isDisabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      employee: user.employee
        ? {
            ...user.employee,
            dailyRate: toRateNumber(user.employee.position?.dailyRate),
            position: user.employee.position?.name ?? null,
            department: user.employee.department?.name ?? null,
          }
        : null,
      isLoggedIn: true,
    };
  },
);
