"use server"; // Indicates this file contains Server Actions (code that runs only on the server)

// Import revalidatePath to clear the cache for specific routes after data updates
import { revalidatePath } from "next/cache";
// Import the database client instance
import { db } from "@/lib/db";
// Import validation schemas and types for type safety
import {
  employeeContributionSchema,
  type EmployeeContributionInput,
} from "@/lib/validations/contributions";
import { getSession as getAuthSession } from "@/lib/auth";
import type { EmployeeContribution } from "@prisma/client";

// Define a type for input (we no longer need actorUserId from the client)
type UpsertPayload = Omit<EmployeeContributionInput, "effectiveDate"> & {
  effectiveDate?: Date | string;
};

const toNumber = (value: unknown) => {
  if (value === null || typeof value === "undefined") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const maybe = value as { toNumber?: () => number; toString?: () => string };
  if (typeof maybe.toNumber === "function") {
    return maybe.toNumber();
  }
  if (typeof maybe.toString === "function") {
    const parsed = Number(maybe.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const serializeContribution = (contribution: EmployeeContribution | null) => {
  if (!contribution) return null;
  return {
    id: contribution.id,
    employeeId: contribution.employeeId,
    sssEe: toNumber(contribution.sssEe),
    sssEr: toNumber(contribution.sssEr),
    isSssActive: contribution.isSssActive,
    philHealthEe: toNumber(contribution.philHealthEe),
    philHealthEr: toNumber(contribution.philHealthEr),
    isPhilHealthActive: contribution.isPhilHealthActive,
    pagIbigEe: toNumber(contribution.pagIbigEe),
    pagIbigEr: toNumber(contribution.pagIbigEr),
    isPagIbigActive: contribution.isPagIbigActive,
    withholdingEe: toNumber(contribution.withholdingEe),
    withholdingEr: toNumber(contribution.withholdingEr),
    isWithholdingActive: contribution.isWithholdingActive,
    effectiveDate: contribution.effectiveDate.toISOString(),
    createdAt: contribution.createdAt.toISOString(),
    updatedAt: contribution.updatedAt.toISOString(),
    createdById: contribution.createdById,
    updatedById: contribution.updatedById,
  };
};

// =========================================================
// ACTION: GET EMPLOYEE CONTRIBUTION
// =========================================================
export async function getEmployeeContribution(employeeId: string | undefined) {
  try {
    // Validation: Ensure employeeId is provided
    if (!employeeId) {
      return { success: false, error: "Employee ID is required" };
    }

    // Database Query: Find a unique contribution record for this employee
    const contribution = await db.employeeContribution.findUnique({
      where: { employeeId },
    });

    // Return the data (or null if not found) with a success flag
    return { success: true, data: serializeContribution(contribution) };
  } catch (error) {
    console.error("Error fetching employee contribution:", error);
    return { success: false, error: "Failed to fetch contribution" };
  }
}

// =========================================================
// ACTION: UPSERT (Create or Update) EMPLOYEE CONTRIBUTION
// =========================================================
export async function upsertEmployeeContribution(input: UpsertPayload) {
  try {
    // 1. Get the current session to identify the actor (Audit Log)
    // We do this server-side for security instead of trusting the client
    const session = await getAuthSession();
    const actorId = session?.userId ?? null;

    // 2. Validate the input using Zod schema
    const parsed = employeeContributionSchema.safeParse(input);
    if (!parsed.success) {
      // If validation fails, format the error messages and return failures
      const message = parsed.error.issues
        .map((e) => e.message)
        .filter(Boolean)
        .join(", ");
      return { success: false, error: message || "Invalid contribution data" };
    }

    const data = parsed.data;

    // 3. Prepare the data payload for the database
    // This maps the validated input to the database fields
    const payload = {
      sssEe: data.sssEe,
      sssEr: data.sssEr,
      isSssActive: data.isSssActive ?? true, // Default to true if undefined
      philHealthEe: data.philHealthEe,
      philHealthEr: data.philHealthEr,
      isPhilHealthActive: data.isPhilHealthActive ?? true,
      pagIbigEe: data.pagIbigEe,
      pagIbigEr: data.pagIbigEr,
      isPagIbigActive: data.isPagIbigActive ?? true,
      withholdingEe: data.withholdingEe,
      withholdingEr: data.withholdingEr,
      isWithholdingActive: data.isWithholdingActive ?? true,
      effectiveDate: data.effectiveDate ?? new Date(), // Default to now if undefined
      updatedById: actorId, // Track who updated this record (from session)
      // createdById is only set during creation (see below)
    };

    // 4. Check if a contribution record already exists for this employee
    const existing = await db.employeeContribution.findUnique({
      where: { employeeId: data.employeeId },
    });

    // 5. Perform Update or Create logic
    const record = existing
      ? await db.employeeContribution.update({
          // Update existing record
          where: { employeeId: data.employeeId },
          data: payload,
        })
      : await db.employeeContribution.create({
          // Create new record
          data: {
            employeeId: data.employeeId,
            ...payload,
            createdById: actorId, // Track who created this record (from session)
          },
        });

    // 5. Revalidate cache so the UI updates immediately
    revalidatePath("/admin/contributions");
    revalidatePath(`/admin/employees/${data.employeeId}/view`);

    return { success: true, data: serializeContribution(record) };
  } catch (error) {
    console.error("Error upserting employee contribution:", error);
    return { success: false, error: "Failed to save contribution" };
  }
}

// =========================================================
// ACTION: LIST CONTRIBUTION DIRECTORY
// =========================================================
// Fetches a list of employees and their contribution summaries for the directory view
export async function listContributionDirectory() {
  try {
    // 1. Fetch employees with specific fields needed for the table
    const employees = await db.employee.findMany({
      where: {
        // Filter out inactive or ended employees
        currentStatus: {
          notIn: ["INACTIVE", "ENDED"],
        },
        // Filter out archived employees
        isArchived: false,
      },
      orderBy: { lastName: "asc" }, // Sort alphabetically by last name
      select: {
        // optimistically select only fields we need for performance
        employeeId: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        department: {
          select: { name: true }, // Join department to get the name
        },
        img: true,
        contribution: true, // Join contribution data
        updatedAt: true,
      },
    });

    // 2. Transform the raw data into a flat structure for the UI
    const rows = employees.map((emp) => {
      // Safely access department name
      const departmentName =
        typeof emp.department === "object" && emp.department
          ? emp.department.name || ""
          : "";

      // Combine first and last name
      const fullName = [emp.firstName, emp.lastName].filter(Boolean).join(" ");

      const c = emp.contribution;
      const serializedContribution = serializeContribution(c);

      const sssEe = serializedContribution?.sssEe ?? 0;
      const philHealthEe = serializedContribution?.philHealthEe ?? 0;
      const pagIbigEe = serializedContribution?.pagIbigEe ?? 0;
      const withholdingEe = serializedContribution?.withholdingEe ?? 0;
      const sssEr = serializedContribution?.sssEr ?? 0;
      const philHealthEr = serializedContribution?.philHealthEr ?? 0;
      const pagIbigEr = serializedContribution?.pagIbigEr ?? 0;
      const withholdingEr = serializedContribution?.withholdingEr ?? 0;

      // Calculate total employee contribution
      const eeTotal = sssEe + philHealthEe + pagIbigEe + withholdingEe;

      // Return the shaped object
      return {
        employeeId: emp.employeeId,
        employeeCode: emp.employeeCode,
        employeeName: fullName || "Unnamed Employee",
        department: departmentName,
        avatarUrl: emp.img,
        updatedAt:
          serializedContribution?.updatedAt ?? emp.updatedAt.toISOString(),
        contribution: serializedContribution,
        eeTotal,
        isSet: eeTotal > 0, // Flag to easily show if contributions are set
      };
    });

    return { success: true, data: rows };
  } catch (error) {
    console.error("Error listing contribution directory:", error);
    return { success: false, error: "Failed to load contributions" };
  }
}
