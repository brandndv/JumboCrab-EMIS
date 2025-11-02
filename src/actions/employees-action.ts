"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { SUFFIX } from "@/lib/validations/employees";

type GENDER = "MALE" | "FEMALE";
type CIVIL_STATUS = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
type EMPLOYMENT_STATUS = "REGULAR" | "PROBATIONARY" | "TRAINING";
type CURRENT_STATUS =
  | "ACTIVE"
  | "ON_LEAVE"
  | "VACATION"
  | "SICK_LEAVE"
  | "INACTIVE";

type Employee = {
  id: string;
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  sex: GENDER;
  civilStatus: CIVIL_STATUS;
  birthdate: Date;
  address: string | null;
  img: string | null;
  startDate: Date;
  endDate: Date | null;
  position: string;
  department: string;
  employmentStatus: EMPLOYMENT_STATUS;
  currentStatus: CURRENT_STATUS;
  email: string | null;
  phone: string | null;
  nationality: string;
  userId: string | null;
  suffix: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getEmployees() {
  try {
    const employees = await db.employee.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      data: employees,
    };
  } catch (error) {
    console.error("Error in getEmployees:", error);
    return {
      success: false,
      error: "Failed to fetch employees",
    };
  }
}

export async function getEmployeeById(id: string) {
  try {
    const employee = await db.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    return { success: true, data: employee };
  } catch (error) {
    console.error("Error in getEmployeeById:", error);
    return { success: false, error: "Failed to fetch employee" };
  }
}

export async function createEmployee(
  employeeData: Omit<Employee, "id" | "createdAt" | "updatedAt">
) {
  try {
    const newEmployee = await db.employee.create({
      data: {
        ...employeeData,
        id: Math.random().toString(36).substr(2, 9),
        suffix: employeeData.suffix as SUFFIX | null, // Add type assertion here
      },
    });

    revalidatePath("/dashboard/employees");
    return { success: true, data: newEmployee };
  } catch (error) {
    console.error("Error in createEmployee:", error);
    return { success: false, error: "Failed to create employee" };
  }
}

export async function updateEmployee(
  employeeData: Partial<Employee> & { id: string }
) {
  try {
    const { id, ...data } = employeeData;

    // Validate ID
    if (!id) {
      console.error("Error: No ID provided for update");
      return { success: false, error: "Employee ID is required for update" };
    }

    console.log("Updating employee with ID:", id);
    console.log("Update data:", data);

    // Create a new object with only the fields we want to update
    const updateData: Record<string, any> = { updatedAt: new Date() };

    // Manually map each field we want to allow updating
    const allowedFields = [
      "employeeCode",
      "firstName",
      "middleName",
      "lastName",
      "sex",
      "civilStatus",
      "birthdate",
      "address",
      "img",
      "startDate",
      "endDate",
      "position",
      "department",
      "employmentStatus",
      "currentStatus",
      "email",
      "phone",
      "nationality",
      "suffix",
    ] as const;

    // Only include fields that are in the allowed list and not undefined
    allowedFields.forEach((field) => {
      if (field in data && data[field as keyof typeof data] !== undefined) {
        updateData[field] = data[field as keyof typeof data];
      }
    });

    // Handle suffix specifically
    if ("suffix" in data) {
      const suffixValue = data.suffix;
      if (
        suffixValue === null ||
        (typeof suffixValue === "string" &&
          (SUFFIX as readonly string[]).includes(suffixValue))
      ) {
        updateData.suffix = suffixValue as SUFFIX | null;
      } else {
        delete updateData.suffix;
      }
    }

    console.log("Final update data:", updateData);

    const updatedEmployee = await db.employee.update({
      where: { id },
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

export async function deleteEmployee(id: string) {
  try {
    await db.employee.delete({
      where: { id },
    });

    revalidatePath("/dashboard/employees");
    return { success: true };
  } catch (error) {
    console.error("Error in deleteEmployee:", error);
    return { success: false, error: "Failed to delete employee" };
  }
}

export async function getDepartments() {
  try {
    const departments = await db.employee.groupBy({
      by: ["department"],
      _count: {
        department: true,
      },
    });

    return {
      success: true,
      data: departments.map((d) => d.department),
    };
  } catch (error) {
    console.error("Error in getDepartments:", error);
    return {
      success: false,
      error: "Failed to fetch departments",
    };
  }
}
