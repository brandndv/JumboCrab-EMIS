"use server";

import { Roles } from "@prisma/client";
import { getSession, hashPassword, sessionOptions, signIn } from "@/lib/auth";
import { getRole } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

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

    const session = await getSession();
    session.userId = result.user.userId;
    session.username = result.user.username;
    session.email = result.user.email;
    session.role = result.user.role;
    session.isLoggedIn = true;
    await session.save();

    return {
      success: true,
      user: {
        userId: result.user.userId,
        username: result.user.username,
        email: result.user.email,
        role: result.user.role,
      },
    };
  } catch (error) {
    console.error("Sign in error:", error);
    return { success: false, error: "Internal Server Error" };
  }
}

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

export async function createAuthUser(input: {
  username: string;
  email: string;
  password: string;
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
    createdAt: Date;
    updatedAt: Date;
    employee?: {
      employeeId: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
    } | null;
  };
  error?: string;
}> {
  try {
    const username =
      typeof input.username === "string" ? input.username.trim() : "";
    const email = typeof input.email === "string" ? input.email.trim() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const role = input.role;
    const employeeId =
      typeof input.employeeId === "string" ? input.employeeId : null;

    if (!username || !password || !email || !role) {
      return {
        success: false,
        error: "Username, email, password, and role are required",
      };
    }

    if (role === "employee" && !employeeId) {
      return {
        success: false,
        error: "Employee ID is required for employee role",
      };
    }

    if (password.length < 6) {
      return {
        success: false,
        error: "Password must be at least 6 characters",
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

    const validRoles = Object.values(Roles);
    const roleValue = role.toString().trim();
    const normalizedRole =
      roleValue.charAt(0).toLowerCase() + roleValue.slice(1);

    if (!validRoles.includes(normalizedRole as Roles)) {
      return {
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      };
    }

    if (role === "employee" && employeeId) {
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

    const { salt, hash } = await hashPassword(password);

    const user = await db.user.create({
      data: {
        username,
        email,
        password: hash,
        salt,
        role: normalizedRole as Roles,
        isDisabled: false,
        ...(role === "employee" &&
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

    return { success: true, user };
  } catch (error) {
    console.error("Create user error:", error);
    return { success: false, error: "Internal Server Error" };
  }
}
