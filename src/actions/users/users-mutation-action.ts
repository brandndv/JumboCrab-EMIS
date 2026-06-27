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
  canManageAccountRole,
  getManageableAccountRoles,
  getForcedPasswordChangePath,
  normalizeRole,
} from "@/lib/rbac";
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
    const session = await getSession();
    const actorUserId = session.userId ?? null;
    const actorRole = normalizeRole(session.role);
    const userId =
      typeof input.userId === "string" ? input.userId.trim() : "";
    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const existingUser = await db.user.findUnique({
      where: { userId },
      select: { userId: true, role: true },
    });
    if (!existingUser) {
      return { success: false, error: "User not found" };
    }
    if (!canManageAccountRole(actorRole, existingUser.role)) {
      const allowedRoles = getManageableAccountRoles(actorRole);
      return {
        success: false,
        error:
          allowedRoles.length > 0
            ? `You can only update these roles: ${allowedRoles.join(", ")}`
            : "You are not allowed to update user accounts",
      };
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
      if (!canManageAccountRole(actorRole, dbRole)) {
        const allowedRoles = getManageableAccountRoles(actorRole);
        return {
          success: false,
          error:
            allowedRoles.length > 0
              ? `You can only assign these roles: ${allowedRoles.join(", ")}`
              : "You are not allowed to assign account roles",
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
      updates.mustChangePassword = true;
      updates.passwordChangedAt = null;
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

    const updatedRole = normalizeRole(updatedUser.role);
    const actorLink =
      actorRole != null ? `/${actorRole}/users/${updatedUser.userId}/view` : "/sign-in";

    if (
      typeof input.isDisabled === "boolean" &&
      actorUserId &&
      actorUserId !== updatedUser.userId
    ) {
      const targetLink = updatedRole ? `/${updatedRole}/account` : "/sign-in";

      await createAndDispatchNotification({
        eventType: input.isDisabled
          ? NotificationEventType.ACCOUNT_DISABLED
          : NotificationEventType.ACCOUNT_ENABLED,
        module: NotificationModule.USERS,
        title: input.isDisabled ? "Account disabled" : "Account enabled",
        message: input.isDisabled
          ? "A user account has been disabled."
          : "A user account has been re-enabled.",
        severity: input.isDisabled
          ? NotificationSeverity.WARNING
          : NotificationSeverity.SUCCESS,
        actorUserId,
        entityType: "User",
        entityId: updatedUser.userId,
        linkHref: actorLink,
        recipients: {
          userIds: [actorUserId],
        },
        emailEligible: false,
      });

      await createAndDispatchNotification({
        eventType: input.isDisabled
          ? NotificationEventType.ACCOUNT_DISABLED
          : NotificationEventType.ACCOUNT_ENABLED,
        module: NotificationModule.SECURITY,
        title: input.isDisabled ? "Your account was disabled" : "Your account was enabled",
        message: input.isDisabled
          ? "Your JumboCrab EMIS account has been disabled. Contact an administrator for help."
          : "Your JumboCrab EMIS account has been enabled again.",
        severity: input.isDisabled
          ? NotificationSeverity.WARNING
          : NotificationSeverity.SUCCESS,
        actorUserId,
        entityType: "User",
        entityId: updatedUser.userId,
        linkHref: targetLink,
        recipients: {
          userIds: [updatedUser.userId],
        },
        emailEligible: true,
      });
    }

    if (input.password && updatedRole) {
      await createAndDispatchNotification({
        eventType: NotificationEventType.PASSWORD_CHANGE_REQUIRED,
        module: NotificationModule.SECURITY,
        title: "Password reset required",
        message:
          "Your password was reset by an administrator. Change it after your next sign in.",
        severity: NotificationSeverity.WARNING,
        actorUserId,
        entityType: "User",
        entityId: updatedUser.userId,
        linkHref: getForcedPasswordChangePath(updatedRole),
        recipients: {
          userIds: [updatedUser.userId],
        },
        emailEligible: true,
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
