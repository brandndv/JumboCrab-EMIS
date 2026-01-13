"use server";

// ========== IMPORTS ========= //
import { revalidatePath } from "next/cache";
import { db, checkConnection } from "@/lib/db";
import {
  EMPLOYEE_CODE_REGEX,
  Employee,
  SUFFIX,
  createEmployeeSchema, // Imported Zod schema
} from "@/lib/validations/employees";
import { generateUniqueEmployeeCode } from "@/lib/employees/employee-code";
import type { Employee as PrismaEmployee, Prisma } from "@prisma/client";

// ... (getEmployees and getEmployeeById headers omitted as they are unchanged)

// ========== GET EMPLOYEES ========= //
export async function getEmployees(): Promise<{
  success: boolean;
  data?: PrismaEmployee[];
  error?: string;
}> {
  try {
    console.log("Fetching employees...");
    const employees = await db.employee.findMany({
      orderBy: { employeeCode: "asc" },
      include: {
        department: { select: { departmentId: true, name: true } },
        position: { select: { positionId: true, name: true } },
      },
    });
    const normalized = employees.map((emp) => ({
      ...emp,
      department: (emp as any).department?.name ?? null,
      position: (emp as any).position?.name ?? null,
    })) as unknown as PrismaEmployee[];
    console.log(`Fetched ${employees.length} employees`);
    return { success: true, data: normalized };
  } catch (error) {
    console.error("Error in getEmployees:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      success: false,
      error: "Failed to fetch employees. Check server logs for details.",
    };
  }
}

// ========== GET EMPLOYEE BY ID ========= //
export async function getEmployeeById(id: string | undefined): Promise<{
  success: boolean;
  data?: PrismaEmployee | null;
  error?: string;
}> {
  try {
    if (!id) {
      return {
        success: false,
        error: "Employee ID is required",
      };
    }

    const employee = await db.employee.findUnique({
      where: { employeeId: id },
      include: {
        department: { select: { departmentId: true, name: true } },
        position: { select: { positionId: true, name: true } },
      },
    });

    if (!employee) {
      return {
        success: false,
        error: `Employee with ID ${id} not found`,
      };
    }

    const normalized = employee
      ? ({
          ...employee,
          department: (employee as any).department?.name ?? null,
          position: (employee as any).position?.name ?? null,
        } as unknown as PrismaEmployee)
      : employee;

    return { success: true, data: normalized };
  } catch (error) {
    console.error(`Error fetching employee with ID ${id}:`, error);
    return {
      success: false,
      error: "An error occurred while fetching the employee",
    };
  }
}

// ========== GENERATE EMPLOYEE CODE ========= //
export async function getGeneratedEmployeeCode(): Promise<{
  success: boolean;
  employeeCode?: string;
  error?: string;
}> {
  try {
    const employeeCode = await generateUniqueEmployeeCode();
    return { success: true, employeeCode };
  } catch (error) {
    console.error("Failed to generate employee code:", error);
    return { success: false, error: "Failed to generate employee code" };
  }
}

// ========== CREATE EMPLOYEE ========= //
export async function createEmployee(employeeData: Employee): Promise<{
  success: boolean;
  data?: PrismaEmployee;
  error?: string;
}> {
  try {
    console.log("Creating new employee with data:", employeeData);

    // 1. Handle Employee Code (Generate if missing or invalid)
    // Zod expects a string fitting the regex, so we ensure it's present.
    const code =
      typeof employeeData.employeeCode === "string" &&
      EMPLOYEE_CODE_REGEX.test(employeeData.employeeCode)
        ? employeeData.employeeCode
        : await generateUniqueEmployeeCode();

    // 2. Prepare payload for validation
    // Merge the generated code back into the data object
    const payloadStart = {
      ...employeeData,
      employeeCode: code,
    };

    // 3. Validate and Coerce with Zod
    // This handles:'
    // - Date string -> Date object conversion (z.coerce.date)
    // - Enums (Gender, Civil Status)
    // - Required fields check
    // - Suffix validation
    const parsed = createEmployeeSchema.safeParse(payloadStart);

    if (!parsed.success) {
      const errorMessage = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      console.error("Validation failed:", errorMessage);
      return {
        success: false,
        error: `Validation failed: ${errorMessage}`,
      };
    }

    // Extract relational identifiers and drop legacy fields not in Prisma schema
    const {
      userId,
      departmentId,
      positionId,
      department: _legacyDepartment,
      position: _legacyPosition,
      ...baseData
    } = parsed.data;
    void _legacyDepartment;
    void _legacyPosition;

    const { suffix, ...restBaseData } = baseData;
    type AllowedSuffix = (typeof SUFFIX)[number];
    const normalizedSuffix: AllowedSuffix | null =
      typeof suffix === "string" && SUFFIX.includes(suffix as AllowedSuffix)
        ? (suffix as AllowedSuffix)
        : null;

    const employeeCreateData = {
      ...restBaseData,
      ...(suffix !== undefined && { suffix: normalizedSuffix }),
      departmentId: departmentId ?? null,
      positionId: positionId ?? null,
      userId: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Prisma.EmployeeUncheckedCreateInput;
    console.log("Final validated create data:", employeeCreateData);

    // 4. Create in Database
    const newEmployee = await db.employee.create({
      data: employeeCreateData,
      include: {
        user: true,
      },
    });

    revalidatePath("/dashboard/employees");
    return { success: true, data: newEmployee };
  } catch (error) {
    console.error("Error in createEmployee:", error);
    return {
      success: false,
      error: `Failed to create employee: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// ========== UPDATE EMPLOYEE ========= //
export async function updateEmployee(
  employeeData: Partial<PrismaEmployee> & { employeeId: string }
): Promise<{
  success: boolean;
  data?: PrismaEmployee;
  error?: string;
}> {
  const isConnected = await checkConnection();
  if (!isConnected) {
    throw new Error("Database connection not available");
  }

  try {
    const data = JSON.parse(JSON.stringify(employeeData));
    const { employeeId } = data;
    delete data.employeeId;

    if ("employeeCode" in data) {
      delete data.employeeCode;
    }

    const currentData = await db.employee.findUnique({
      where: { employeeId },
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        nationality: true,
        updatedAt: true,
      },
    });

    console.log(
      "[SERVER] Current employee data in DB:",
      JSON.stringify(currentData, null, 2)
    );

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    const allowedFields = [
      "employeeCode",
      "firstName",
      "middleName",
      "lastName",
      "sex",
      "birthdate",
      "startDate",
      "civilStatus",
      "departmentId",
      "positionId",
      "supervisorId",
      "employmentStatus",
      "currentStatus",
      "nationality",
      "address",
      "city",
      "state",
      "postalCode",
      "country",
      "img",
      "endDate",
      "isEnded",
      "email",
      "phone",
      "description",
      "suffix",
      "emergencyContactName",
      "emergencyContactRelationship",
      "emergencyContactPhone",
      "emergencyContactEmail",
      "userId",
    ];

    allowedFields.forEach((field) => {
      if (field in data) {
        updateData[field] = data[field];
      }
    });

    (["birthdate", "startDate", "endDate"] as const).forEach((field) => {
      if (field in updateData) {
        const value = updateData[field];
        if (value == null || value === "") {
          updateData[field] = field === "endDate" ? null : undefined;
          if (updateData[field] === undefined) delete updateData[field];
          return;
        }
        const parsed = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          delete updateData[field];
        } else {
          updateData[field] = parsed;
        }
      }
    });

    if (data.suffix && !SUFFIX.includes(data.suffix)) {
      delete updateData.suffix;
    }

    const updatedEmployee = await db.employee.update({
      where: { employeeId },
      data: updateData,
    });

    revalidatePath("/dashboard/employees");
    return { success: true, data: updatedEmployee };
  } catch (error) {
    console.error("Error in updateEmployee:", error);
    return {
      success: false,
      error: `Failed to update employee: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// ========== ARCHIVE/UNARCHIVE EMPLOYEE ========= //
export async function setEmployeeArchiveStatus(
  employeeId: string,
  isArchived: boolean
): Promise<{
  success: boolean;
  data?: { employeeId: string; isArchived: boolean; userUpdated: boolean };
  error?: string;
}> {
  try {
    if (!employeeId) {
      return { success: false, error: "Employee ID is required" };
    }

    const existing = await db.employee.findUnique({
      where: { employeeId },
      include: { user: true },
    });

    if (!existing) {
      return {
        success: false,
        error: `Employee with ID ${employeeId} not found`,
      };
    }

    const employee = await db.employee.update({
      where: { employeeId },
      data: {
        isArchived: Boolean(isArchived),
        updatedAt: new Date(),
      },
    });

    let userUpdated = false;
    if (existing.user) {
      await db.user.update({
        where: { userId: existing.user.userId },
        data: { isDisabled: Boolean(isArchived) },
      });
      userUpdated = true;
    }

    return {
      success: true,
      data: { employeeId: employee.employeeId, isArchived: employee.isArchived, userUpdated },
    };
  } catch (error) {
    console.error(`Failed to update employee ${employeeId}:`, error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update employee status";
    return { success: false, error: message };
  }
}

export async function deleteEmployee(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!id) {
      return { success: false, error: "Employee ID is required" };
    }

    const existing = await db.employee.findUnique({
      where: { employeeId: id },
      select: { employeeId: true, userId: true },
    });
    if (!existing) {
      return { success: false, error: `Employee with ID ${id} not found` };
    }

    await db.$transaction(async (tx) => {
      if (existing.userId) {
        await tx.employee.update({
          where: { employeeId: id },
          data: { userId: null },
        });
      }
      await tx.employee.delete({ where: { employeeId: id } });
    });

    revalidatePath("/dashboard/employees");
    return { success: true };
  } catch (error) {
    console.error(`Error deleting employee with ID ${id}:`, error);
    return {
      success: false,
      error: `Failed to delete employee: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// ========== GET EMPLOYEE BY CODE ========= //
export async function getEmployeeByCode(code: string): Promise<{
  success: boolean;
  data?: PrismaEmployee | null;
  error?: string;
}> {
  try {
    const employee = await db.employee.findUnique({
      where: { employeeCode: code },
    });

    if (!employee) {
      return {
        success: false,
        error: `Employee with code ${code} not found`,
      };
    }

    return { success: true, data: employee };
  } catch (error) {
    console.error(`Error fetching employee with code ${code}:`, error);
    return {
      success: false,
      error: "An error occurred while fetching the employee",
    };
  }
}

// ========== GET EMPLOYEE BY USER ID ========= //
export async function getEmployeeByUserId(userId: string): Promise<{
  success: boolean;
  data?: PrismaEmployee | null;
  error?: string;
}> {
  try {
    const employee = await db.employee.findFirst({
      where: { userId },
    });

    if (!employee) {
      return {
        success: false,
        error: `Employee with user ID ${userId} not found`,
      };
    }

    return { success: true, data: employee };
  } catch (error) {
    console.error(`Error fetching employee with user ID ${userId}:`, error);
    return {
      success: false,
      error: "An error occurred while fetching the employee",
    };
  }
}

// src/actions/employees-action.ts
// Add this function to the end of the file

// ========== GET EMPLOYEES WITHOUT USER ACCOUNT ========= //
export async function getEmployeesWithoutUser() {
  try {
    const employees = await db.employee.findMany({
      where: {
        user: null,
      },
      select: {
        employeeId: true, // Changed from id to employeeId
        firstName: true,
        lastName: true,
        employeeCode: true,
        email: true,
      },
      orderBy: {
        employeeCode: "asc",
      },
    });

    return {
      success: true,
      data: employees,
    };
  } catch (error) {
    console.error("Error fetching employees without user accounts:", error);
    return {
      success: false,
      error: "Failed to fetch employees without user accounts",
    };
  }
}

// ========== GET DEPARTMENTS ========= //
export async function getDepartments(): Promise<{
  success: boolean;
  data?: { departmentId: string; name: string }[];
  error?: string;
}> {
  try {
    const departments = await db.department.findMany({
      where: { isActive: true },
      select: { departmentId: true, name: true },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: departments,
    };
  } catch (error) {
    console.error("Error fetching departments:", error);
    return {
      success: false,
      error: "Failed to fetch departments. Please try again later.",
    };
  }
}
