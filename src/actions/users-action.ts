"use server";

import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import type { UserWithEmployee } from "@/lib/validations/users";

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
      data: user ? normalizeUsers([user])[0] : user,
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
