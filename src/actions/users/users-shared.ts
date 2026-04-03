import { Prisma, Roles } from "@prisma/client";
import type { UserWithEmployee } from "@/lib/validations/users";
import { normalizeRole } from "@/lib/rbac";

export function isHiddenManagementRole(
  role: Roles | string | null | undefined,
) {
  return normalizeRole(role) === "admin";
}

export function toDbRole(role: string): Roles | null {
  const appRole = normalizeRole(role);
  if (!appRole) return null;

  switch (appRole) {
    case "admin":
      return Roles.Admin;
    case "generalManager":
      return Roles.GeneralManager;
    case "manager":
      return Roles.Manager;
    case "supervisor":
      return Roles.Supervisor;
    case "employee":
      return Roles.Employee;
    default:
      return null;
  }
}

export const baseUserSelect = {
  userId: true,
  username: true,
  email: true,
  role: true,
  isDisabled: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      employeeId: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      position: { select: { name: true } },
      department: { select: { name: true } },
      employmentStatus: true,
      currentStatus: true,
      startDate: true,
      endDate: true,
      img: true,
    },
  },
} as const satisfies Prisma.UserSelect;

type BaseUserRow = Prisma.UserGetPayload<{ select: typeof baseUserSelect }>;

export const normalizeUsers = (users: BaseUserRow[]): UserWithEmployee[] =>
  users.map((user) => ({
    ...user,
    role: normalizeRole(user.role) ?? "employee",
    employee: user.employee
      ? {
          ...user.employee,
          position: user.employee.position?.name ?? null,
          department: user.employee.department?.name ?? null,
        }
      : null,
  }));

export const normalizeUser = (user: BaseUserRow): UserWithEmployee =>
  normalizeUsers([user])[0];
