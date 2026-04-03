"use server";

import { Roles } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { UserWithEmployee } from "@/lib/validations/users";
import {
  baseUserSelect,
  isHiddenManagementRole,
  normalizeUser,
  toDbRole,
} from "./users-shared";

export async function updateUser(input: {
  userId: string;
  username?: string;
  email?: string;
  role?: string;
  password?: string;
  isDisabled?: boolean;
}): Promise<{
  success: boolean;
  data?: UserWithEmployee;
  error?: string;
}> {
  try {
    const userId =
      typeof input.userId === "string" ? input.userId.trim() : "";
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const existingUser = await db.user.findUnique({
      where: { userId },
      select: { userId: true, role: true },
    });
    if (!existingUser || isHiddenManagementRole(existingUser.role)) {
      return { success: false, error: "User not found" };
    }

    const updates: Record<string, unknown> = {};
    if (typeof input.username === "string") {
      updates.username = input.username.trim();
    }
    if (typeof input.email === "string") {
      updates.email = input.email.trim();
    }
    if (typeof input.isDisabled === "boolean") {
      updates.isDisabled = input.isDisabled;
    }

    if (input.role !== undefined) {
      const dbRole = toDbRole(input.role);
      if (!dbRole) {
        return {
          success: false,
          error: `Invalid role. Must be one of: ${Object.values(Roles).join(", ")}`,
        };
      }
      if (dbRole === Roles.Admin) {
        return {
          success: false,
          error: "Admin accounts cannot be created or managed from this screen",
        };
      }
      updates.role = dbRole;
    }

    if (input.password) {
      if (typeof input.password !== "string" || input.password.length < 6) {
        return {
          success: false,
          error: "Password must be at least 6 characters",
        };
      }
      const { salt, hash } = await hashPassword(input.password);
      updates.password = hash;
      updates.salt = salt;
    }

    if (Object.keys(updates).length === 0) {
      return {
        success: false,
        error: "No valid fields provided to update",
      };
    }

    if (updates.username) {
      const existing = await db.user.findFirst({
        where: { username: updates.username as string, NOT: { userId } },
        select: { userId: true },
      });
      if (existing) {
        return { success: false, error: "Username already in use" };
      }
    }

    if (updates.email) {
      const existingEmail = await db.user.findFirst({
        where: { email: updates.email as string, NOT: { userId } },
        select: { userId: true },
      });
      if (existingEmail) {
        return { success: false, error: "Email already in use" };
      }
    }

    const updatedUser = await db.user.update({
      where: { userId },
      data: updates,
      select: baseUserSelect,
    });

    if (
      typeof input.isDisabled === "boolean" &&
      updatedUser.employee?.employeeId
    ) {
      await db.employee.update({
        where: { employeeId: updatedUser.employee.employeeId },
        data: { isArchived: input.isDisabled },
      });
    }

    return { success: true, data: normalizeUser(updatedUser) };
  } catch (error) {
    console.error("Error updating user:", error);
    return { success: false, error: "Failed to update user" };
  }
}

export async function deleteUser(input: {
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userId =
      typeof input.userId === "string" ? input.userId.trim() : "";
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const user = await db.user.findUnique({
      where: { userId },
      include: { employee: true },
    });

    if (!user || isHiddenManagementRole(user.role)) {
      return { success: false, error: "User not found" };
    }

    if (user.employee?.employeeId) {
      await db.employee.update({
        where: { employeeId: user.employee.employeeId },
        data: { userId: null },
      });
    }

    await db.user.delete({ where: { userId } });

    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, error: "Failed to delete user" };
  }
}
