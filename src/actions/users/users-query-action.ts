"use server";

import { Roles } from "@prisma/client";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import type { UserWithEmployee } from "@/lib/validations/users";
import {
  baseUserSelect,
  isHiddenManagementRole,
  normalizeUser,
  normalizeUsers,
} from "./users-shared";

export async function getUsers(): Promise<{
  success: boolean;
  data: UserWithEmployee[] | null;
  error: string | null;
}> {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: {
          not: Roles.Admin,
        },
      },
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

    const user = await db.user.findUnique({
      where: { userId: id },
      select: baseUserSelect,
    });

    if (!user || isHiddenManagementRole(user.role)) {
      return {
        success: false,
        error: `User with ID ${id} not found`,
      };
    }

    return {
      success: true,
      data: normalizeUser(user),
    };
  } catch (error) {
    console.error(`Error fetching user with ID ${id}:`, error);
    return {
      success: false,
      error: "An error occurred while fetching the user",
    };
  }
}

export async function getUsersWithEmployeeAccount(): Promise<{
  success: boolean;
  data: UserWithEmployee[] | null;
  error: string | null;
}> {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: {
          not: Roles.Admin,
        },
      },
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
