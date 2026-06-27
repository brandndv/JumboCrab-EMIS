"use server";

import crypto from "crypto";
import {
  NotificationEventType,
  NotificationModule,
  NotificationSeverity,
  Roles,
} from "@prisma/client";
import { getSession, hashPassword, sessionOptions, signIn } from "@/lib/auth";
import {
  buildAccountCreatedEmail,
  getAppBaseUrl,
  isEmailConfigured,
  sendEmail,
} from "@/lib/email";
import { getRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { createAndDispatchNotification } from "@/lib/notifications";
import {
  canManageAccountRole,
  getManageableAccountRoles,
  getPostSignInPath,
  normalizeRole,
} from "@/lib/rbac";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

function toDbRole(role: Roles | string): Roles | null {
  const appRole = normalizeRole(role);
  if (!appRole) return null;

  switch (appRole) {
    case "admin":
      return Roles.Admin;
    case "generalManager":
      return Roles.GeneralManager;
    case "manager":
      return Roles.Manager;
    case "supervisor":
      return Roles.Supervisor;
    case "employee":
      return Roles.Employee;
    default:
      return null;
  }
}

export async function signInUser(input: {
  username: string;
  password: string;
}): Promise<{
  success: boolean;
  user?: {
    userId: string;
    username: string;
    email: string;
    role: Roles;
    mustChangePassword: boolean;
    redirectPath: string;
  };
  error?: string;
}> {
  try {
    const username =
      typeof input.username === "string" ? input.username.trim() : "";
    const password = typeof input.password === "string" ? input.password : "";

    if (!username || !password) {
      return { success: false, error: "Username and password are required" };
    }

    const result = await signIn(username, password);

    if (!result.success || !result.user) {
      return {
        success: false,
        error: result.error || "Invalid credentials",
      };
    }

    if (result.user.isDisabled) {
      return {
        success: false,
        error: "Account is disabled. Contact an administrator.",
      };
    }

    if (!normalizeRole(result.user.role)) {
      return {
        success: false,
        error: "This account role is no longer supported. Contact an administrator.",
      };
    }

    const session = await getSession();
    session.userId = result.user.userId;
    session.username = result.user.username;
    session.email = result.user.email;
    session.role = result.user.role;
    session.mustChangePassword = result.user.mustChangePassword;
    session.isLoggedIn = true;
    await session.save();

    const normalizedRole = normalizeRole(result.user.role);
    if (!normalizedRole) {
      return {
        success: false,
        error: "This account role is no longer supported. Contact an administrator.",
      };
    }

    return {
      success: true,
      user: {
        userId: result.user.userId,
        username: result.user.username,
        email: result.user.email,
        role: result.user.role,
        mustChangePassword: result.user.mustChangePassword,
        redirectPath: getPostSignInPath(
          normalizedRole,
          result.user.mustChangePassword,
        ),
      },
    };
  } catch (error) {
    console.error("Sign in error:", error);
    return { success: false, error: "Internal Server Error" };
  }
}
//! SIGN OUT LOGIC
export async function signOutUser(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getIronSession(await cookies(), sessionOptions);
    session.destroy();
    return { success: true };
  } catch (error) {
    console.error("Sign out error:", error);
    return { success: false, error: "Failed to sign out" };
  }
}

export async function getAuthRole(): Promise<{
  success: boolean;
  role: Roles | null;
  error?: string;
}> {
  try {
    const role = await getRole();
    return { success: true, role };
  } catch (error) {
    console.error("Failed to fetch role:", error);
    return { success: false, role: null, error: "Failed to fetch role" };
  }
}

function generateTemporaryPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

function formatRoleLabel(role: string) {
  return role.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

export async function createAuthUser(input: {
  username: string;
  email: string;
  role: Roles | string;
  employeeId?: string | null;
}): Promise<{
  success: boolean;
  user?: {
    userId: string;
    username: string;
    email: string;
    role: Roles;
    isDisabled: boolean;
    mustChangePassword: boolean;
    createdAt: Date;
    updatedAt: Date;
    employee?: {
      employeeId: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
    } | null;
  };
  emailSent?: boolean;
  temporaryPassword?: string;
  warning?: string;
  error?: string;
}> {
  try {
    const session = await getSession();
    const actorRole = normalizeRole(session.role);
    const actorUserId = session.userId ?? null;
    const username =
      typeof input.username === "string" ? input.username.trim() : "";
    const email = typeof input.email === "string" ? input.email.trim() : "";
    const role = input.role;
    const employeeId =
      typeof input.employeeId === "string" ? input.employeeId : null;

    if (!username || !email || !role) {
      return {
        success: false,
        error: "Username, email, and role are required",
      };
    }

    const appRole = normalizeRole(role);
    if (!appRole) {
      return {
        success: false,
        error: `Invalid role. Must be one of: ${Object.values(Roles).join(", ")}`,
      };
    }

    if (!canManageAccountRole(actorRole, appRole)) {
      const allowedRoles = getManageableAccountRoles(actorRole);
      return {
        success: false,
        error:
          allowedRoles.length > 0
            ? `You can only create these roles: ${allowedRoles.join(", ")}`
            : "You are not allowed to create user accounts",
      };
    }

    if (appRole === "employee" && !employeeId) {
      return {
        success: false,
        error: "Employee ID is required for employee role",
      };
    }

    const existingUser = await db.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { userId: true, username: true, email: true },
    });

    if (existingUser) {
      return {
        success: false,
        error:
          existingUser.username === username
            ? "Username already in use"
            : "Email already in use",
      };
    }

    const dbRole = toDbRole(role);
    if (!dbRole) {
      return {
        success: false,
        error: `Invalid role. Must be one of: ${Object.values(Roles).join(", ")}`,
      };
    }

    if (appRole === "employee" && employeeId) {
      const employee = await db.employee.findUnique({
        where: { employeeId },
        include: { user: true },
      });

      if (!employee) {
        return { success: false, error: "Employee not found" };
      }

      if (employee.user) {
        return {
          success: false,
          error: "This employee is already associated with a user account",
        };
      }
    }

    const temporaryPassword = generateTemporaryPassword();
    const { salt, hash } = await hashPassword(temporaryPassword);

    const user = await db.user.create({
      data: {
        username,
        email,
        password: hash,
        salt,
        role: dbRole,
        isDisabled: false,
        mustChangePassword: true,
        passwordChangedAt: null,
        ...(appRole === "employee" &&
          employeeId && {
            employee: { connect: { employeeId } },
          }),
      },
      select: {
        userId: true,
        username: true,
        email: true,
        role: true,
        isDisabled: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            employeeId: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const appBaseUrl = getAppBaseUrl();
    const signInUrl = new URL("/sign-in", appBaseUrl).toString();
    let emailSent = false;
    let warning: string | undefined;

    if (isEmailConfigured()) {
      try {
        const payload = buildAccountCreatedEmail({
          username,
          tempPassword: temporaryPassword,
          roleLabel: formatRoleLabel(appRole),
          signInUrl,
        });
        await sendEmail({
          to: email,
          ...payload,
        });
        emailSent = true;
      } catch (error) {
        warning =
          error instanceof Error
            ? error.message
            : "Failed to send credentials email.";
      }
    } else {
      warning = "SMTP is not configured. Credentials email was not sent.";
    }

    await createAndDispatchNotification({
      eventType: NotificationEventType.ACCOUNT_CREATED,
      module: NotificationModule.USERS,
      title: "Account created",
      message: "Your JumboCrab EMIS account is ready. Change your temporary password on first sign in.",
      severity: NotificationSeverity.SUCCESS,
      actorUserId,
      entityType: "User",
      entityId: user.userId,
      linkHref: `/${appRole}/account`,
      recipients: {
        userIds: [user.userId],
      },
      emailEligible: false,
    });

    if (!emailSent) {
      await createAndDispatchNotification({
        eventType: NotificationEventType.ACCOUNT_CREDENTIAL_EMAIL_FAILED,
        module: NotificationModule.SECURITY,
        title: "Credential email failed",
        message: `Could not send account credentials for ${username}. Provide the temporary password manually.`,
        severity: NotificationSeverity.WARNING,
        actorUserId,
        entityType: "User",
        entityId: user.userId,
        linkHref:
          actorRole != null
            ? `/${actorRole}/users/${user.userId}/view`
            : "/sign-in",
        recipients: {
          userIds: actorUserId ? [actorUserId] : [],
        },
        emailEligible: false,
      });
    }

    return {
      success: true,
      user,
      emailSent,
      temporaryPassword: emailSent ? undefined : temporaryPassword,
      warning,
    };
  } catch (error) {
    console.error("Create user error:", error);
    return { success: false, error: "Internal Server Error" };
  }
}

export async function changeCurrentUserPassword(input: {
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return { success: false, error: "Unauthorized" };
    }

    const password =
      typeof input.password === "string" ? input.password : "";

    if (password.length < 6) {
      return {
        success: false,
        error: "Password must be at least 6 characters.",
      };
    }

    const { salt, hash } = await hashPassword(password);

    await db.user.update({
      where: {
        userId: session.userId,
      },
      data: {
        password: hash,
        salt,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    session.mustChangePassword = false;
    await session.save();

    return { success: true };
  } catch (error) {
    console.error("Change current user password error:", error);
    return { success: false, error: "Failed to update password." };
  }
}
