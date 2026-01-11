"use server";

import { db } from "@/lib/db";

import type { Prisma } from "@prisma/client";

export type ViolationType = Prisma.ViolationGetPayload<{
  include: {
    employee: {
      select: {
        firstName: true;
        lastName: true;
        employeeCode: true;
        position: {
          select: {
            name: true;
          };
        };
      };
    };
  };
}>;

export async function getViolations(): Promise<{
  success: boolean;
  data?: ViolationType[];
  error?: string;
}> {
  try {
    console.log("Fetching Violations");

    const violations = await db.violation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
            position: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    return {
      success: true,
      data: violations,
    };
  } catch (error) {
    console.error("Error fetching violations:", error);
    return {
      success: false,
      error: "Failed to fetch violations.",
    };
  }
}
