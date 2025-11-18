"use server";

import { prisma } from "@/lib/prisma";
import { User } from "@prisma/client";

export async function getUsers(): Promise<{
  success: boolean;
  data: User[] | null;
  error: string | null;
}> {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    return { success: true, data: users, error: null };
  } catch (error) {
    console.error("Error fetching users:", error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch users",
    };
  }
}
