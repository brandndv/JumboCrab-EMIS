"use server";

import { Roles } from "@prisma/client";
import { db } from "@/lib/db";

type SupervisorUser = {
  userId: string;
  username: string;
  email: string;
  role: string;
};

type StructureEmployee = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  supervisorUserId?: string | null;
  role?: string | null;
  department?: { departmentId: string; name: string } | null;
  position?: { positionId: string; name: string } | null;
};

export async function getOrganizationStructure(): Promise<{
  success: boolean;
  data?: StructureEmployee[];
  supervisors?: SupervisorUser[];
  supervisorGroups?: { supervisor: SupervisorUser; reports: StructureEmployee[] }[];
  unassigned?: StructureEmployee[];
  error?: string;
}> {
  try {
    const [employees, supervisors] = await Promise.all([
      db.employee.findMany({
        where: { isArchived: false },
        orderBy: { employeeCode: "asc" },
        select: {
          employeeId: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          supervisorUserId: true,
          user: { select: { userId: true, role: true, username: true, email: true } },
          department: { select: { departmentId: true, name: true } },
          position: { select: { positionId: true, name: true } },
        },
      }),
      db.user.findMany({
        where: {
          role: {
            in: [
              Roles.Admin,
              Roles.GeneralManager,
              Roles.Manager,
              Roles.Supervisor,
            ],
          },
        },
        select: { userId: true, username: true, email: true, role: true },
        orderBy: { username: "asc" },
      }),
    ]);

    const payload: StructureEmployee[] = employees.map((employee) => ({
      employeeId: employee.employeeId,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      supervisorUserId: employee.supervisorUserId,
      role: employee.user?.role ?? null,
      department: employee.department ?? null,
      position: employee.position ?? null,
    }));

    const supervisorGroups = supervisors.map((sup) => ({
      supervisor: sup,
      reports: [] as StructureEmployee[],
    }));
    const reportsBySupervisor = new Map<string, StructureEmployee[]>(
      supervisorGroups.map((group) => [group.supervisor.userId, group.reports])
    );
    const unassigned: StructureEmployee[] = [];

    payload.forEach((emp) => {
      const bucket = emp.supervisorUserId
        ? reportsBySupervisor.get(emp.supervisorUserId)
        : undefined;
      if (bucket) {
        bucket.push(emp);
      } else {
        unassigned.push(emp);
      }
    });

    return {
      success: true,
      data: payload,
      supervisors,
      supervisorGroups,
      unassigned,
    };
  } catch (error) {
    console.error("Failed to fetch organization structure", error);
    return { success: false, error: "Failed to load structure" };
  }
}

export async function updateEmployeeSupervisor(input: {
  employeeId: string;
  supervisorUserId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const employeeId =
      typeof input.employeeId === "string" ? input.employeeId.trim() : "";
    const supervisorId =
      typeof input.supervisorUserId === "string" && input.supervisorUserId.trim() !== ""
        ? input.supervisorUserId.trim()
        : null;

    if (!employeeId) {
      return { success: false, error: "employeeId is required" };
    }

    const employee = await db.employee.findUnique({
      where: { employeeId },
      select: { employeeId: true },
    });
    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    if (supervisorId) {
      const supervisor = await db.user.findUnique({
        where: { userId: supervisorId },
        select: { userId: true },
      });
      if (!supervisor) {
        return { success: false, error: "Supervisor not found" };
      }
    }

    await db.employee.update({
      where: { employeeId },
      data: { supervisorUserId: supervisorId },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to update supervisor", error);
    return { success: false, error: "Failed to update supervisor" };
  }
}
