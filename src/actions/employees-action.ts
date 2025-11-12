"use server";

// ========== IMPORTS ========= //
import { revalidatePath } from "next/cache";
import { db, checkConnection } from "@/lib/db";
import {
  type Employee as EmployeeType,
  type GENDER,
  type CIVIL_STATUS,
  type EMPLOYMENT_STATUS,
  type CURRENT_STATUS,
  SUFFIX,
  type SUFFIX as SUFFIX_TYPE,
} from "@/lib/validations/employees";

// ========== GET EMPLOYEES ========= //
export async function getEmployees() {
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
/**
 * Retrieves a single employee by their unique ID
 * @param id - The unique identifier of the employee to retrieve
 * @returns Object containing success status and either the employee data or an error message
 */
export async function getEmployeeById(id: string | undefined): Promise<{
  success: boolean;
  data?: EmployeeType | null;
  error?: string;
}> {
  try {
    if (!id) {
      return {
        success: false,
        error: "Employee ID is required",
      };
    }

    // Query the database for a single employee with the specified ID
    const employee = await db.employee.findUnique({
      where: { id },
    });

    // If no employee is found, return an error
    if (!employee) {
      return {
        success: false,
        error: `Employee with ID ${id} not found`,
      };
    }

    // Return the found employee
    return { success: true, data: employee };
  } catch (error) {
    // Log the error and return a generic error message
    console.error(`Error fetching employee with ID ${id}:`, error);
    return {
      success: false,
      error: "An error occurred while fetching the employee",
    };
  }
}

// ========== CREATE EMPLOYEE ========= //
export async function createEmployee(
  employeeData: Omit<EmployeeType, "id" | "createdAt" | "updatedAt">
): Promise<{
  success: boolean;
  data?: EmployeeType;
  error?: string;
}> {
  try {
    console.log("Creating new employee with data:", employeeData);

    // Convert string dates to Date objects if needed
    const parseDate = (date: any): Date => {
      if (date instanceof Date) return date;
      if (typeof date === "string") return new Date(date);
      return new Date();
    };

    // Set default values for required fields
    const defaults = {
      employeeCode: employeeData.employeeCode,
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
      currentStatus: employeeData.currentStatus || "",
      nationality: employeeData.nationality || "",

      middleName: employeeData.middleName || null,
      address: employeeData.address || null,
      img: employeeData.img || null,
      endDate: employeeData.endDate ? parseDate(employeeData.endDate) : null,
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
      userId: employeeData.userId || null,
    };

    // Handle suffix validation
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
        id: Math.random().toString(36).substring(2, 9),
        createdAt: new Date(),
        updatedAt: new Date(),
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
  employeeData: Partial<EmployeeType> & { id: string }
): Promise<{
  success: boolean;
  data?: EmployeeType;
  error?: string;
}> {
  // Verify database connection
  const isConnected = await checkConnection();
  if (!isConnected) {
    throw new Error("Database connection not available");
  }

  try {
    // Create a deep copy of the data to avoid mutating the original
    const data = JSON.parse(JSON.stringify(employeeData));
    const { id } = data;
    delete data.id; // Remove id from the update data

    // Log current state in database before update
    const currentData = await db.employee.findUnique({
      where: { id },
      select: {
        id: true,
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

    // Log current state in database before update
    try {
      const currentData = await db.employee.findUnique({
        where: { id },
        select: {
          id: true,
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
    } catch (dbError) {
      console.error("[SERVER] Error fetching current employee data:", dbError);
    }

    // Prepare update data with proper typing
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    // Define allowed fields for update
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
      "email",
      "phone",
      "suffix",
      "nationality",
      "description",
      "emergencyContactName",
      "emergencyContactRelationship",
      "emergencyContactPhone",
      "emergencyContactEmail",
      "city",
      "state",
      "postalCode",
      "country",
      "address",
    ] as const;

    // Log the data we're about to process
    console.log(
      "[SERVER] Processing update with data:",
      JSON.stringify(data, null, 2)
    );

    // Initialize fields to update with updatedAt
    const fieldsToUpdate: Record<string, any> = {
      updatedAt: new Date(),
    };

    // Helper function to parse dates
    const parseDate = (date: any): Date | null => {
      if (!date) return null;
      if (date instanceof Date) return date;
      if (typeof date === "string") return new Date(date);
      return null;
    };

    // Handle date fields
    const dateFields = ["birthdate", "startDate", "endDate"];
    dateFields.forEach((field) => {
      if (field in data) {
        const dateValue = parseDate(data[field as keyof typeof data]);
        if (dateValue) {
          fieldsToUpdate[field] = dateValue;
        }
      }
    });

    // Handle nationality update if it's in the data
    if ("nationality" in data) {
      console.log("[SERVER] Processing nationality update...");

      // Convert empty string to null for nationality
      data.nationality = data.nationality === "" ? null : data.nationality;

      // Log the nationality value we're trying to set
      console.log("[SERVER] Setting nationality to:", data.nationality);

      // Ensure nationality is included in the fields to update
      fieldsToUpdate.nationality = data.nationality;
    }

    // Include only allowed fields and handle empty strings
    Object.entries(data).forEach(([key, value]) => {
      if (allowedFields.includes(key as any)) {
        // Skip if the value is undefined or specifically handling nationality
        if (value === undefined || key === "nationality") return;

        // Convert empty strings to null for all fields
        fieldsToUpdate[key] = value === "" ? null : value;
      }
    });

    console.log(
      "[SERVER] Final fields to be updated:",
      JSON.stringify(fieldsToUpdate, null, 2)
    );

    console.log(
      "[SERVER] Fields to be updated with Prisma:",
      JSON.stringify(fieldsToUpdate, null, 2)
    );

    // If no fields to update, return early
    if (Object.keys(fieldsToUpdate).length <= 1) {
      // Only updatedAt
      console.log("[SERVER] No valid fields to update");
      return { success: false, error: "No valid fields to update" };
    }

    // Use a transaction for the update
    try {
      console.log(
        `[SERVER] Updating employee ${id} with data:`,
        JSON.stringify(fieldsToUpdate, null, 2)
      );

      // First, verify the employee exists
      const existing = await db.employee.findUnique({
        where: { id },
        select: { id: true, nationality: true },
      });

      if (!existing) {
        throw new Error(`Employee with ID ${id} not found`);
      }

      console.log(
        `[SERVER] Current nationality before update: ${existing.nationality}`
      );

      // Perform the update
      const updatedEmployee = await db.employee.update({
        where: { id },
        data: fieldsToUpdate,
      });

      console.log(
        `[SERVER] Nationality after update: ${updatedEmployee.nationality}`
      );

      console.log(
        "[SERVER] Update successful. Updated employee:",
        JSON.stringify(updatedEmployee, null, 2)
      );

      revalidatePath("/dashboard/employees");
      return {
        success: true,
        data: updatedEmployee,
      };
    } catch (updateError) {
      console.error("[SERVER] Error updating employee:", updateError);
      return {
        success: false,
        error: `Failed to update employee: ${
          updateError instanceof Error ? updateError.message : "Unknown error"
        }`,
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[SERVER] Error in updateEmployee:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      employeeId: employeeData.id,
      updateData: employeeData,
    });

    return {
      success: false,
      error: `Failed to update employee: ${errorMessage}`,
    };
  }
}

// ========== DELETE EMPLOYEE ========= //
/**
 * Deletes an employee from the database by their ID
 * @param id - The unique identifier of the employee to delete
 * @returns Object indicating success or failure of the operation
 */
export async function deleteEmployee(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // First, verify the employee exists
    const existingEmployee = await db.employee.findUnique({
      where: { id },
    });

    if (!existingEmployee) {
      return {
        success: false,
        error: `Employee with ID ${id} not found`,
      };
    }

    // If the employee exists, proceed with deletion
    await db.employee.delete({
      where: { id },
    });

    // Revalidate the employees page to reflect the deletion
    revalidatePath("/dashboard/employees");

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Error deleting employee with ID ${id}:`, errorMessage);
    return {
      success: false,
      error: `Failed to delete employee: ${errorMessage}`,
    };
  }
}

// ========== GET DEPARTMENTS ========= //
/**
 * Retrieves a list of unique department names from the database
 * @returns Array of department names
 */
export async function getDepartments(): Promise<{
  success: boolean;
  data?: string[];
  error?: string;
}> {
  try {
    // Use Prisma's distinct to get unique department values
    const employees = await db.employee.findMany();
    const departments = [
      ...new Set(
        employees
          .map((emp: EmployeeType) => emp.department)
          .filter(Boolean as any)
      ),
    ];
    const departmentCounts = departments.reduce(
      (acc: Record<string, number>, d: string) => {
        acc[d] = employees.filter(
          (emp: EmployeeType) => emp.department === d
        ).length;
        return acc;
      },
      {} as Record<string, number>
    );

    // Extract just the department strings from the results
    const departmentList = departments;

    return { success: true, data: departmentList };
  } catch (error) {
    console.error("Error fetching departments:", error);
    return {
      success: false,
      error: "Failed to fetch departments. Please try again later.",
    };
  }
}
