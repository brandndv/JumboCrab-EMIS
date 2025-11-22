import { db } from "@/lib/db";

const EMPLOYEE_CODE_PREFIX = "EMP-";
const MAX_GENERATION_ATTEMPTS = 100;

/**
 * Generates a random, unique employee code following the EMP-000 pattern.
 * Retries a limited number of times to avoid collisions.
 */
export async function generateUniqueEmployeeCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const randomNumber = Math.floor(Math.random() * 1000);
    const employeeCode = `${EMPLOYEE_CODE_PREFIX}${randomNumber
      .toString()
      .padStart(3, "0")}`;

    const existing = await db.employee.findUnique({
      where: { employeeCode },
      select: { employeeId: true },
    });

    if (!existing) {
      return employeeCode;
    }
  }

  throw new Error("Unable to generate a unique employee code");
}
