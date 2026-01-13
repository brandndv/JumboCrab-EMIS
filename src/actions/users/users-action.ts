"use server";

import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import type { UserWithEmployee } from "@/lib/validations/users";
import { Roles } from "@prisma/client";
import { hashPassword } from "@/lib/auth";

const baseUserSelect = {
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
      position: { select: { name: true } },
      department: { select: { name: true } },
      employmentStatus: true,
      currentStatus: true,
      startDate: true,
      endDate: true,
      img: true,
    },
  },
} as const;

const normalizeUsers = (users: any[]) =>
  users.map((u) => ({
    ...u,
    employee: u.employee
      ? {
          ...u.employee,
          position: u.employee.position?.name ?? null,
          department: u.employee.department?.name ?? null,
        }
      : null,
  }));

const normalizeUser = (user: any) => normalizeUsers([user])[0];

// ========= GET USERS ========= /
export async function getUsers(): Promise<{
  success: boolean;
  data: UserWithEmployee[] | null;
  error: string | null;
}> {
  try {
    const users = await prisma.user.findMany({
      select: baseUserSelect,
      orderBy: {
        createdAt: "desc",
      },
    });
    return { success: true, data: normalizeUsers(users), error: null };
  } catch (error) {
    console.error("Error fetching users:", error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch users",
    };
  }
}

// ========== GET USERS BY ID ========= //
/**
 * Retrieves a single employee by their unique ID
 * @param id - The unique identifier of the employee to retrieve
 * @returns Object containing success status and either the employee data or an error message
 */
export async function getUserById(id: string | undefined): Promise<{
  success: boolean;
  data?: UserWithEmployee | null;
  error?: string;
}> {
  try {
    if (!id) {
      return {
        success: false,
        error: "User ID is required",
      };
    }

    // Query the database for a single user with the specified ID and include employee data
    const user = await db.user.findUnique({
      where: { userId: id }, // Changed from { id }
      select: baseUserSelect,
    });

    // If no user is found, return an error
    if (!user) {
      return {
        success: false,
        error: `User with ID ${id} not found`,
      };
    }

    // Return the found user with employee data (if any)
    return {
      success: true,
      data: user ? normalizeUser(user) : user,
    };
  } catch (error) {
    // Log the error and return a generic error message
    console.error(`Error fetching user with ID ${id}:`, error);
    return {
      success: false,
      error: "An error occurred while fetching the user",
    };
  }
}

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
      select: { userId: true },
    });
    if (!existingUser) {
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
      const validRoles = Object.values(Roles);
      const normalizedRole = input.role as Roles;
      if (!validRoles.includes(normalizedRole)) {
        return {
          success: false,
          error: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
        };
      }
      updates.role = normalizedRole;
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

    if (!user) {
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

// GET USERS WITH EMPLOYEE ACCOUNT

export async function getUsersWithEmployeeAccount(): Promise<{
  success: boolean;
  data: UserWithEmployee[] | null;
  error: string | null;
}> {
  try {
    const users = await prisma.user.findMany({
      select: baseUserSelect,
      orderBy: {
        createdAt: "desc",
      },
    });
    return {
      success: true,
      data: normalizeUsers(users),
      error: null,
    };
  } catch (error) {
    console.error("Error fetching users with employee data:", error);
    return {
      success: false,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch users with employee data",
    };
  }
}
