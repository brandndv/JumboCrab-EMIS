export const APP_ROLES = [
  "admin",
  "generalManager",
  "manager",
  "supervisor",
  "clerk",
  "employee",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ADMIN_PANEL_ROLES: AppRole[] = ["admin", "generalManager"];

export const EMPLOYEE_PANEL_ROLES: AppRole[] = ["employee"];

type AccessRule = {
  path: string;
  allowedRoles: AppRole[];
};

const ROLE_BASE_PATHS: Record<AppRole, string> = {
  admin: "/admin",
  generalManager: "/generalManager",
  manager: "/manager",
  supervisor: "/supervisor",
  clerk: "/clerk",
  employee: "/employee",
};

function rolePath(role: AppRole, subPath = "") {
  const basePath = ROLE_BASE_PATHS[role];
  if (!subPath || subPath === "/") return basePath;

  const normalizedSubPath = subPath.startsWith("/") ? subPath : `/${subPath}`;
  return `${basePath}${normalizedSubPath}`;
}

const RBAC_RULES: AccessRule[] = [
  {
    path: rolePath("admin", "/users"),
    allowedRoles: ["admin", "generalManager"],
  },
  {
    path: rolePath("admin", "/employees/new"),
    allowedRoles: ["admin"],
  },
  {
    path: rolePath("admin", "/employees"),
    allowedRoles: ["admin"],
  },
  {
    path: rolePath("admin", "/organization/departments"),
    allowedRoles: ["admin"],
  },
  {
    path: rolePath("admin", "/organization/positions"),
    allowedRoles: ["admin"],
  },
  {
    path: rolePath("admin", "/organization/structure"),
    allowedRoles: ["admin"],
  },
  {
    path: rolePath("admin", "/organization"),
    allowedRoles: ["admin"],
  },
  {
    path: rolePath("admin", "/attendance/overrides"),
    allowedRoles: ["admin"],
  },
  {
    path: rolePath("admin", "/attendance/shifts"),
    allowedRoles: ["admin"],
  },
  {
    path: rolePath("admin", "/attendance/patterns"),
    allowedRoles: ["admin"],
  },
  {
    path: rolePath("admin", "/attendance"),
    allowedRoles: ["admin"],
  },
  {
    path: rolePath("admin", "/contributions"),
    allowedRoles: ["admin"],
  },
  {
    path: rolePath("admin", "/violations"),
    allowedRoles: ["admin"],
  },

  {
    path: rolePath("manager", "/users"),
    allowedRoles: ["manager"],
  },
  { path: rolePath("admin"), allowedRoles: ADMIN_PANEL_ROLES },
  { path: rolePath("employee"), allowedRoles: EMPLOYEE_PANEL_ROLES },
  { path: rolePath("manager"), allowedRoles: ["manager"] },
  { path: rolePath("generalManager"), allowedRoles: ["generalManager"] },
];

const ROLE_NORMALIZATION: Record<string, AppRole> = {
  admin: "admin",
  generalmanager: "generalManager",
  manager: "manager",
  supervisor: "supervisor",
  clerk: "clerk",
  employee: "employee",
};

function hasPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function normalizeRole(role: unknown): AppRole | null {
  if (typeof role !== "string") return null;
  const normalizedKey = role.replace(/[\s_-]/g, "").toLowerCase();
  return ROLE_NORMALIZATION[normalizedKey] ?? null;
}

export function getHomePathForRole(role: AppRole): string {
  return rolePath(role, "/dashboard");
}

export function getRoleFromPath(pathname: string): AppRole | null {
  const [firstSegment] = pathname.split("/").filter(Boolean);
  return normalizeRole(firstSegment);
}

export function toCanonicalRolePath(pathname: string): string {
  const roleFromPath = getRoleFromPath(pathname);
  if (!roleFromPath) return pathname;

  const firstSlashAfterRole = pathname.indexOf("/", 1);
  const restPath =
    firstSlashAfterRole === -1 ? "" : pathname.slice(firstSlashAfterRole);
  return `${rolePath(roleFromPath)}${restPath}`;
}

export function getAllowedRolesForPath(pathname: string): AppRole[] | null {
  const rule = RBAC_RULES.find((candidate) =>
    hasPathPrefix(pathname, candidate.path),
  );
  return rule?.allowedRoles ?? null;
}
