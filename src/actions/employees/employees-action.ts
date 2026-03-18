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

const toRateNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDateInput = (value: unknown): Date | null => {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeOptionalId = (value: unknown): string | null => {
  if (value == null) return null;
  const normalized =
    typeof value === "string" ? value.trim() : String(value).trim();
  return normalized === "" ? null : normalized;
};

const isSameRate = (left: number | null, right: number | null) => {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return Math.abs(left - right) < 0.000001;
};

const isMissingRateHistoryTableError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const maybeCode = (error as { code?: unknown }).code;
  return maybeCode === "P2021";
};

type EmployeeRelationIds = {
  userId?: unknown;
  departmentId?: unknown;
  positionId?: unknown;
  employeeTypeId?: unknown;
  supervisorUserId?: unknown;
};

const normalizeEmployeeRelationIds = (input: EmployeeRelationIds) => ({
  userId: normalizeOptionalId(input.userId),
  departmentId: normalizeOptionalId(input.departmentId),
  positionId: normalizeOptionalId(input.positionId),
  employeeTypeId: normalizeOptionalId(input.employeeTypeId),
  supervisorUserId: normalizeOptionalId(input.supervisorUserId),
});

const validateEmployeeRelationIds = async (
  input: ReturnType<typeof normalizeEmployeeRelationIds>,
): Promise<string | null> => {
  const [user, supervisorUser, department, position, employeeType] =
    await Promise.all([
      input.userId
        ? db.user.findUnique({
            where: { userId: input.userId },
            select: { userId: true },
          })
        : Promise.resolve(null),
      input.supervisorUserId
        ? db.user.findUnique({
            where: { userId: input.supervisorUserId },
            select: { userId: true },
          })
        : Promise.resolve(null),
      input.departmentId
        ? db.department.findUnique({
            where: { departmentId: input.departmentId },
            select: { departmentId: true },
          })
        : Promise.resolve(null),
      input.positionId
        ? db.position.findUnique({
            where: { positionId: input.positionId },
            select: { positionId: true, departmentId: true, isActive: true },
          })
        : Promise.resolve(null),
      input.employeeTypeId
        ? db.employeeType.findUnique({
            where: { employeeTypeId: input.employeeTypeId },
            select: { employeeTypeId: true },
          })
        : Promise.resolve(null),
    ]);

  if (input.userId && !user) {
    return "Selected user not found";
  }
  if (input.supervisorUserId && !supervisorUser) {
    return "Selected supervisor not found";
  }
  if (input.departmentId && !department) {
    return "Selected department not found";
  }
  if (input.positionId && !position) {
    return "Selected position not found";
  }
  if (input.employeeTypeId && !employeeType) {
    return "Selected employee type not found";
  }
  if (position && !position.isActive) {
    return "Selected position is no longer active";
  }
  if (
    position &&
    input.departmentId &&
    position.departmentId !== input.departmentId
  ) {
    return "Selected position does not belong to the selected department";
  }

  return null;
};

export type EmployeeActionRecord = Omit<PrismaEmployee, "dailyRate"> & {
  dailyRate: number | null;
  department?: string | null;
  position?: string | null;
  employeeType?: string | null;
};

type EmployeeWithLookupRelations = Prisma.EmployeeGetPayload<{
  include: {
    department: { select: { departmentId: true; name: true } };
    position: { select: { positionId: true; name: true } };
    employeeType: { select: { employeeTypeId: true; name: true } };
  };
}>;

const serializeEmployeeRecord = (
  employee: PrismaEmployee,
): EmployeeActionRecord => ({
  ...employee,
  dailyRate: toRateNumber(employee.dailyRate),
});

const getFallbackRateHistory = async (
  employeeId: string,
  reason: string,
): Promise<EmployeeRateHistoryItem[]> => {
  const employee = await db.employee.findUnique({
    where: { employeeId },
    select: {
      employeeId: true,
      dailyRate: true,
      startDate: true,
      updatedAt: true,
    },
  });

  const fallbackRate = toRateNumber(employee?.dailyRate);
  if (!employee || fallbackRate == null) {
    return [];
  }

  return [
    {
      id: `fallback-${employee.employeeId}`,
      employeeId: employee.employeeId,
      dailyRate: fallbackRate,
      effectiveFrom: employee.startDate.toISOString(),
      reason,
      createdAt: employee.updatedAt.toISOString(),
    },
  ];
};

const EMPLOYEE_ROUTE_PREFIXES = [
  "/admin/employees",
  "/manager/employees",
  "/generalManager/employees",
] as const;

const revalidateEmployeePages = (employeeId?: string) => {
  revalidatePath("/dashboard/employees");
  EMPLOYEE_ROUTE_PREFIXES.forEach((prefix) => {
    revalidatePath(prefix);
    if (employeeId) {
      revalidatePath(`${prefix}/${employeeId}/view`);
      revalidatePath(`${prefix}/${employeeId}/edit`);
    }
  });
};

// ... (getEmployees and getEmployeeById headers omitted as they are unchanged)

// ========== GET EMPLOYEES ========= //
export async function getEmployees(): Promise<{
  success: boolean;
  data?: EmployeeActionRecord[];
  error?: string;
}> {
  try {
    console.log("Fetching employees...");
    const employees = await db.employee.findMany({
      orderBy: { employeeCode: "asc" },
      include: {
        department: { select: { departmentId: true, name: true } },
        position: { select: { positionId: true, name: true } },
        employeeType: { select: { employeeTypeId: true, name: true } },
      },
    });
    const normalized = (employees as EmployeeWithLookupRelations[]).map((emp) =>
      ({
        ...emp,
        dailyRate: toRateNumber(emp.dailyRate),
        department: emp.department?.name ?? null,
        position: emp.position?.name ?? null,
        employeeType: emp.employeeType?.name ?? null,
      }) satisfies EmployeeActionRecord,
    );
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
  data?: EmployeeActionRecord | null;
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
        employeeType: { select: { employeeTypeId: true, name: true } },
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
          dailyRate: toRateNumber(employee.dailyRate),
          department: (employee as EmployeeWithLookupRelations).department?.name ?? null,
          position: (employee as EmployeeWithLookupRelations).position?.name ?? null,
          employeeType:
            (employee as EmployeeWithLookupRelations).employeeType?.name ?? null,
        } satisfies EmployeeActionRecord)
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

export type EmployeeRateHistoryItem = {
  id: string;
  employeeId: string;
  dailyRate: number | null;
  effectiveFrom: string;
  reason: string | null;
  createdAt: string;
};

export async function getEmployeeRateHistory(
  employeeId: string | undefined,
): Promise<{
  success: boolean;
  data?: EmployeeRateHistoryItem[];
  warning?: string;
  error?: string;
}> {
  if (!employeeId) {
    return { success: false, error: "Employee ID is required" };
  }

  try {
    const rows = await db.employeeRateHistory.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: "desc" },
      select: {
        id: true,
        employeeId: true,
        dailyRate: true,
        effectiveFrom: true,
        reason: true,
        createdAt: true,
      },
    });

    if (rows.length === 0) {
      return {
        success: true,
        data: await getFallbackRateHistory(employeeId, "Current employee rate"),
      };
    }

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        dailyRate: toRateNumber(row.dailyRate),
        effectiveFrom: row.effectiveFrom.toISOString(),
        reason: row.reason ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    if (isMissingRateHistoryTableError(error)) {
      console.warn(
        "EmployeeRateHistory table is not available yet. Returning empty history.",
      );
      const fallback = await getFallbackRateHistory(
        employeeId,
        "Current employee rate (history table not yet migrated)",
      );
      return {
        success: true,
        data: fallback,
        warning: "Rate history table not found. Run database migration.",
      };
    }
    console.error(
      `Error fetching rate history for employee ${employeeId}:`,
      error,
    );
    return {
      success: false,
      error: "An error occurred while fetching employee rate history",
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
  data?: EmployeeActionRecord;
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
    const normalizedRelationIds = normalizeEmployeeRelationIds({
      userId,
      departmentId,
      positionId,
    });
    const relationError =
      await validateEmployeeRelationIds(normalizedRelationIds);
    if (relationError) {
      return { success: false, error: relationError };
    }

    const employeeCreateData = {
      ...restBaseData,
      ...(suffix !== undefined && { suffix: normalizedSuffix }),
      departmentId: normalizedRelationIds.departmentId,
      positionId: normalizedRelationIds.positionId,
      userId: normalizedRelationIds.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Prisma.EmployeeUncheckedCreateInput;
    console.log("Final validated create data:", employeeCreateData);

    // 4. Create employee first; history write is best-effort and must not block creation.
    const newEmployee = await db.employee.create({
      data: employeeCreateData,
    });

    const initialRate = toRateNumber(employeeCreateData.dailyRate);
    if (initialRate != null) {
      try {
        await db.employeeRateHistory.create({
          data: {
            employeeId: newEmployee.employeeId,
            dailyRate: initialRate,
            effectiveFrom: employeeCreateData.startDate ?? new Date(),
            reason: "Initial daily rate",
          },
        });
      } catch (error) {
        if (!isMissingRateHistoryTableError(error)) {
          throw error;
        }
        console.warn(
          "EmployeeRateHistory table is not available yet. Skipping initial rate history write.",
        );
      }
    }

    revalidateEmployeePages(newEmployee.employeeId);
    return { success: true, data: serializeEmployeeRecord(newEmployee) };
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
  employeeData: Partial<PrismaEmployee> & {
    employeeId: string;
    rateEffectiveFrom?: string | Date | null;
    rateReason?: string | null;
  }
): Promise<{
  success: boolean;
  data?: EmployeeActionRecord;
  error?: string;
}> {
  const isConnected = await checkConnection();
  if (!isConnected) {
    throw new Error("Database connection not available");
  }

  try {
    const data = JSON.parse(JSON.stringify(employeeData));
    const { employeeId, rateEffectiveFrom, rateReason } = data;
    delete data.employeeId;
    delete data.rateEffectiveFrom;
    delete data.rateReason;

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
        dailyRate: true,
        updatedAt: true,
      },
    });

    if (!currentData) {
      return { success: false, error: "Employee not found" };
    }

    console.log(
      "[SERVER] Current employee data in DB:",
      JSON.stringify(currentData, null, 2)
    );

    const updateData: Record<string, unknown> & { updatedAt: Date } = {
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
      "employeeTypeId",
      "supervisorUserId",
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
      "dailyRate",
      "userId",
    ] as const;

    allowedFields.forEach((field) => {
      if (field in data) {
        updateData[field] = data[field as keyof typeof data];
      }
    });

    const normalizedRelationIds = normalizeEmployeeRelationIds({
      userId: updateData.userId,
      departmentId: updateData.departmentId,
      positionId: updateData.positionId,
      employeeTypeId: updateData.employeeTypeId,
      supervisorUserId: updateData.supervisorUserId,
    });

    (
      [
        "userId",
        "departmentId",
        "positionId",
        "employeeTypeId",
        "supervisorUserId",
      ] as const
    ).forEach((field) => {
      if (field in updateData) {
        updateData[field] = normalizedRelationIds[field];
      }
    });

    const relationError =
      await validateEmployeeRelationIds(normalizedRelationIds);
    if (relationError) {
      return { success: false, error: relationError };
    }

    (["birthdate", "startDate", "endDate"] as const).forEach((field) => {
      if (field in updateData) {
        const value = updateData[field];
        if (value == null || value === "") {
          updateData[field] = field === "endDate" ? null : undefined;
          if (updateData[field] === undefined) delete updateData[field];
          return;
        }
        const parsed = parseDateInput(value);
        if (!parsed) {
          delete updateData[field];
        } else {
          updateData[field] = parsed;
        }
      }
    });

    if (data.suffix && !SUFFIX.includes(data.suffix)) {
      delete updateData.suffix;
    }

    const parsedRateEffectiveFrom = parseDateInput(rateEffectiveFrom);
    if (
      rateEffectiveFrom != null &&
      rateEffectiveFrom !== "" &&
      !parsedRateEffectiveFrom
    ) {
      return {
        success: false,
        error: "Rate effective date is invalid",
      };
    }
    const rateHistoryEffectiveFrom = parsedRateEffectiveFrom ?? new Date();
    const normalizedRateReason =
      typeof rateReason === "string" ? rateReason.trim() : "";

    if ("dailyRate" in updateData) {
      const value = updateData.dailyRate;
      if (value == null || value === "") {
        updateData.dailyRate = null;
      } else {
        const parsed =
          typeof value === "number" ? value : Number.parseFloat(String(value));
        if (Number.isNaN(parsed) || parsed < 0) {
          return {
            success: false,
            error: "Daily rate must be a valid non-negative number",
          };
        } else {
          updateData.dailyRate = parsed;
        }
      }
    }

    const hasDailyRateUpdate = Object.prototype.hasOwnProperty.call(
      updateData,
      "dailyRate",
    );
    const previousDailyRate = toRateNumber(currentData.dailyRate);
    const nextDailyRate = hasDailyRateUpdate
      ? toRateNumber(updateData.dailyRate)
      : null;

    // Save employee first so rate changes persist even if history table is unavailable.
    const updatedEmployee = await db.employee.update({
      where: { employeeId },
      data: updateData as Prisma.EmployeeUncheckedUpdateInput,
    });

    if (
      hasDailyRateUpdate &&
      !isSameRate(previousDailyRate, nextDailyRate)
    ) {
      try {
        await db.employeeRateHistory.upsert({
          where: {
            employeeId_effectiveFrom: {
              employeeId,
              effectiveFrom: rateHistoryEffectiveFrom,
            },
          },
          create: {
            employeeId,
            dailyRate: nextDailyRate,
            effectiveFrom: rateHistoryEffectiveFrom,
            reason:
              normalizedRateReason ||
              (nextDailyRate == null
                ? "Daily rate cleared"
                : "Daily rate updated"),
          },
          update: {
            dailyRate: nextDailyRate,
            reason:
              normalizedRateReason ||
              (nextDailyRate == null
                ? "Daily rate cleared (corrected)"
                : "Daily rate corrected"),
          },
        });
      } catch (error) {
        if (!isMissingRateHistoryTableError(error)) {
          throw error;
        }
        console.warn(
          "EmployeeRateHistory table is not available yet. Skipping rate history write.",
        );
      }
    }

    revalidateEmployeePages(employeeId);
    return { success: true, data: serializeEmployeeRecord(updatedEmployee) };
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

    revalidateEmployeePages(employee.employeeId);
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

    revalidateEmployeePages(id);
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
  data?: EmployeeActionRecord | null;
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

    return { success: true, data: serializeEmployeeRecord(employee) };
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
  data?: EmployeeActionRecord | null;
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

    return { success: true, data: serializeEmployeeRecord(employee) };
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
        img: true,
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
