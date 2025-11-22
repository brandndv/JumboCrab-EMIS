"use server";

// ========== IMPORTS ========= //
import { revalidatePath } from "next/cache";
import { db, checkConnection } from "@/lib/db";
import {
  EMPLOYEE_CODE_REGEX,
  SUFFIX,
  type SUFFIX as SUFFIX_TYPE,
} from "@/lib/validations/employees";
import { generateUniqueEmployeeCode } from "@/lib/employees/employee-code";
import type { Employee as PrismaEmployee } from "@prisma/client";

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
    });
    console.log(`Fetched ${employees.length} employees`);
    return { success: true, data: employees };
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
    });

    if (!employee) {
      return {
        success: false,
        error: `Employee with ID ${id} not found`,
      };
    }

    return { success: true, data: employee };
  } catch (error) {
    console.error(`Error fetching employee with ID ${id}:`, error);
    return {
      success: false,
      error: "An error occurred while fetching the employee",
    };
  }
}

// ========== CREATE EMPLOYEE ========= //
export async function createEmployee(employeeData: any): Promise<{
  success: boolean;
  data?: PrismaEmployee;
  error?: string;
}> {
  try {
    console.log("Creating new employee with data:", employeeData);

    const parseDate = (date: any): Date => {
      if (date instanceof Date) return date;
      if (typeof date === "string") return new Date(date);
      return new Date();
    };

    const employeeCode =
      typeof employeeData.employeeCode === "string" &&
      EMPLOYEE_CODE_REGEX.test(employeeData.employeeCode)
        ? employeeData.employeeCode
        : await generateUniqueEmployeeCode();

    const defaults = {
      employeeCode,
      firstName: employeeData.firstName || "",
      lastName: employeeData.lastName || "",
      sex: employeeData.sex || "",
      civilStatus: employeeData.civilStatus || "",
      birthdate: employeeData.birthdate
        ? parseDate(employeeData.birthdate)
        : new Date(),
      startDate: employeeData.startDate
        ? parseDate(employeeData.startDate)
        : new Date(),
      position: employeeData.position || "",
      department: employeeData.department || "",
      employmentStatus: employeeData.employmentStatus || "",
      currentStatus:
        typeof (employeeData as any).isEnded === "boolean" &&
        (employeeData as any).isEnded
          ? "ENDED"
          : employeeData.currentStatus || "",
      nationality: employeeData.nationality || "",
      middleName: employeeData.middleName || null,
      address: employeeData.address || null,
      city: (employeeData as any).city ?? null,
      state: (employeeData as any).state ?? null,
      postalCode: (employeeData as any).postalCode ?? null,
      country: (employeeData as any).country ?? null,
      img: employeeData.img || null,
      endDate: employeeData.endDate ? parseDate(employeeData.endDate) : null,
      isEnded:
        typeof (employeeData as any).isEnded === "boolean"
          ? (employeeData as any).isEnded
          : false,
      email: employeeData.email || null,
      phone: employeeData.phone || null,
      description: employeeData.description || null,
      suffix:
        employeeData.suffix && SUFFIX.includes(employeeData.suffix as any)
          ? (employeeData.suffix as SUFFIX_TYPE)
          : null,
      emergencyContactName: employeeData.emergencyContactName || null,
      emergencyContactRelationship:
        employeeData.emergencyContactRelationship || null,
      emergencyContactPhone: employeeData.emergencyContactPhone || null,
      emergencyContactEmail: employeeData.emergencyContactEmail || null,
    };

    if (
      employeeData.suffix &&
      (SUFFIX as readonly string[]).includes(employeeData.suffix)
    ) {
      defaults.suffix = employeeData.suffix as SUFFIX;
    }

    console.log("Final create data:", defaults);

    const newEmployee = await db.employee.create({
      data: {
        ...defaults,
        employeeId: Math.random().toString(36).substring(2, 9),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: employeeData.userId
          ? {
              connect: { userId: employeeData.userId },
            }
          : undefined,
      },
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
      "civilStatus",
      "department",
      "position",
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

export async function deleteEmployee(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await db.employee.delete({
      where: { employeeId: id },
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
  data?: string[];
  error?: string;
}> {
  try {
    const employees = await db.employee.findMany();
    const departments = [
      ...new Set(employees.map((emp) => emp.department).filter(Boolean as any)),
    ];
    const departmentCounts = employees.reduce(
      (acc: Record<string, number>, emp) => {
        if (emp.department) {
          acc[emp.department] = (acc[emp.department] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      success: true,
      data: departments,
      // @ts-ignore - This is just for internal use
      _counts: departmentCounts,
    };
  } catch (error) {
    console.error("Error fetching departments:", error);
    return {
      success: false,
      error: "Failed to fetch departments. Please try again later.",
    };
  }
}
