"use client";

import {
  deleteEmployee,
  setEmployeeArchiveStatus,
} from "@/actions/employees/employees-action";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { Employee } from "@/lib/validations/employees";
import { ChevronDown } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { EmployeesActions } from "./employees-crud";
import { Separator } from "@/components/ui/separator";
import { useEmployees } from "./employees-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PAGE_SIZE_OPTIONS = [8, 12, 24] as const;

const getEmployeeInitials = (employee: Employee) => {
  const first = employee.firstName?.charAt(0) ?? "";
  const last = employee.lastName?.charAt(0) ?? "";
  const initials = `${first}${last}`.trim();
  return initials ? initials.toUpperCase() : "E";
};

function getEntityName(value: unknown, fallback: string) {
  if (typeof value === "string") {
    return value || fallback;
  }

  if (
    value &&
    typeof value === "object" &&
    "name" in value &&
    typeof value.name === "string"
  ) {
    return value.name || fallback;
  }

  return fallback;
}

function getEmployeeDisplayName(employee: Employee) {
  return `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() || "Employee";
}

export default function EmployeesCards({
  employees,
}: {
  employees: Employee[];
}) {
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname();
  const basePath = pathname.replace(/\/$/, "");
  const { refreshEmployees, showArchived } = useEmployees();
  const [pagination, setPagination] = useState<{
    datasetKey: string;
    page: number;
    pageSize: number;
  }>({
    datasetKey: "",
    page: 1,
    pageSize: PAGE_SIZE_OPTIONS[0],
  });

  const datasetKey = useMemo(
    () => employees.map((employee) => employee.employeeId ?? "").join("|"),
    [employees],
  );
  const pageSize = pagination.pageSize;
  const currentPage = pagination.datasetKey === datasetKey ? pagination.page : 1;
  const totalPages = Math.max(1, Math.ceil(employees.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const currentItems = employees.slice(pageStart, pageStart + pageSize);
  const showingFrom = employees.length === 0 ? 0 : pageStart + 1;
  const showingTo = employees.length === 0 ? 0 : Math.min(pageStart + pageSize, employees.length);

  const visiblePageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const start = Math.max(1, safeCurrentPage - 1);
    const end = Math.min(totalPages, start + 2);
    const adjustedStart = Math.max(1, end - 2);

    return Array.from(
      { length: end - adjustedStart + 1 },
      (_, index) => adjustedStart + index,
    );
  }, [safeCurrentPage, totalPages]);

  // Handle view employee
  const handleViewEmployee = (employeeId: string | undefined) => {
    if (!employeeId) {
      console.error("No employee ID provided for view");
      return;
    }
    router.push(`${basePath}/${employeeId}/view`);
  };

  // Handle edit employee
  const handleEditEmployee = (employeeId: string | undefined) => {
    if (!employeeId) {
      console.error("No employee ID provided for edit");
      return;
    }
    router.push(`${basePath}/${employeeId}/edit`);
  };

  // Handle archive employee
  const handleArchiveClick = async (employee: Employee) => {
    if (!employee.employeeId) return;
    const confirmed = window.confirm(
      `Archive ${employee.firstName ?? ""} ${employee.lastName ?? ""}?`,
    );
    if (!confirmed) return;

    try {
      const result = await setEmployeeArchiveStatus(employee.employeeId, true);
      if (!result.success) {
        throw new Error(result.error || "Failed to archive employee");
      }
      await refreshEmployees();
      toast.success("Employee archived successfully.", {
        description: `${getEmployeeDisplayName(employee)} moved to archived records.`,
      });
    } catch (err) {
      console.error("Archive failed:", err);
      toast.error("Failed to archive employee.", {
        description:
          err instanceof Error ? err.message : "Failed to archive employee.",
      });
    }
  };

  const handleUnarchiveClick = async (employee: Employee) => {
    if (!employee.employeeId) return;
    try {
      const result = await setEmployeeArchiveStatus(employee.employeeId, false);
      if (!result.success) {
        throw new Error(result.error || "Failed to unarchive employee");
      }
      await refreshEmployees();
      toast.success("Employee restored successfully.", {
        description: `${getEmployeeDisplayName(employee)} is active again.`,
      });
    } catch (err) {
      console.error("Unarchive failed:", err);
      toast.error("Failed to restore employee.", {
        description:
          err instanceof Error ? err.message : "Failed to unarchive employee.",
      });
    }
  };

  const handleDeleteClick = async (employee: Employee) => {
    if (!employee.employeeId) return;
    const confirmed = window.confirm(
      `Permanently delete ${employee.firstName ?? ""} ${
        employee.lastName ?? ""
      }?`,
    );
    if (!confirmed) return;

    try {
      const result = await deleteEmployee(employee.employeeId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete employee");
      }
      await refreshEmployees();
      toast.success("Employee deleted successfully.", {
        description: `${getEmployeeDisplayName(employee)} has been removed.`,
      });
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete employee.", {
        description:
          err instanceof Error ? err.message : "Failed to delete employee.",
      });
    }
  };

  const paginate = (pageNumber: number) => {
    setPagination((prev) => ({
      ...prev,
      datasetKey,
      page: pageNumber,
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrevious = () => {
    if (safeCurrentPage > 1) {
      paginate(safeCurrentPage - 1);
    }
  };

  const handleNext = () => {
    if (safeCurrentPage < totalPages) {
      paginate(safeCurrentPage + 1);
    }
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4">
        {currentItems.map((employee) => (
          <div
            key={employee.employeeId}
            className="bg-card text-card-foreground rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col min-h-[320px]"
          >
            <div className="flex-1 flex flex-col">
              {/* Header with Avatar and Name */}
              <div className="flex justify-between items-start w-full gap-2">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <Avatar className="h-12 w-12 shrink-0">
                    {employee.img && (
                      <AvatarImage
                        src={employee.img}
                        alt={`${employee.firstName ?? ""} ${
                          employee.lastName ?? ""
                        }`.trim()}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-base">
                      {getEmployeeInitials(employee)}
                    </AvatarFallback>
                  </Avatar>
                  {/* Name/position: allow two lines for name to avoid over-truncation */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-foreground line-clamp-2">
                      {employee.firstName} {employee.lastName}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {getEntityName(employee.position, "No position")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <EmployeesActions
                    employee={employee}
                    onEdit={handleEditEmployee}
                    onArchive={handleArchiveClick}
                    onUnarchive={handleUnarchiveClick}
                    onDelete={handleDeleteClick}
                    isArchivedView={showArchived}
                  />
                </div>
              </div>
              <Separator className="my-2" />

              {/* Employee Info */}
              <div className="flex-1 min-w-0 space-y-3">
                {employee.description && (
                  <div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {employee.description}
                    </p>
                  </div>
                )}
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                    {typeof employee.department === "string"
                      ? employee.department || "No department"
                      : getEntityName(employee.department, "No department")}
                  </div>
                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 text-muted-foreground shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span
                      className="truncate max-w-full"
                      title={employee.email || ""}
                    >
                      {employee.email || "No email"}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    Hired:{" "}
                    {employee.startDate
                      ? new Date(employee.startDate).toLocaleDateString()
                      : "N/A"}
                  </div>
                  {(employee.currentStatus === "ENDED" ||
                    employee.currentStatus === "INACTIVE") && (
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l2 2m6-4a8 8 0 11-16 0 8 8 0 0116 0z"
                        />
                      </svg>
                      End:{" "}
                      {employee.endDate
                        ? new Date(employee.endDate).toLocaleDateString()
                        : "N/A"}
                    </div>
                  )}
                </div>
              </div>
              {/* Status and Preview */}
              <Separator className="my-2" />
              <div>
                <div className="flex justify-between items-center w-full">
                  {(() => {
                    const statusStyles: Record<string, string> = {
                      ACTIVE:
                        "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100",
                      ON_LEAVE:
                        "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100",
                      VACATION:
                        "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-100",
                      SICK_LEAVE:
                        "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-100",
                    };
                    const badgeClass =
                      statusStyles[employee.currentStatus ?? ""] ||
                      "bg-muted text-muted-foreground";
                    const statusLabel = employee.currentStatus
                      ? employee.currentStatus.replace("_", " ")
                      : "Inactive";

                    return (
                      <div
                        className={`mr-auto px-3 py-1 rounded-full text-xs font-medium ${badgeClass}`}
                      >
                        {statusLabel}
                      </div>
                    );
                  })()}
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        employee.employeeId &&
                        handleViewEmployee(employee.employeeId)
                      }
                    >
                      View
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-border/70 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {employees.length === 0
            ? "Showing 0 of 0 employees"
            : `Showing ${showingFrom}-${showingTo} of ${employees.length} employees`}
        </p>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">Rows per page</span>
            <span className="relative">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPagination((prev) => ({
                    ...prev,
                    datasetKey,
                    page: 1,
                    pageSize: Number(e.target.value),
                  }));
                }}
                className="h-10 min-w-[72px] appearance-none rounded-md border border-border bg-background px-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </span>
          </label>

          {totalPages > 1 && (
            <Pagination className="m-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handlePrevious();
                    }}
                    className={
                      safeCurrentPage === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>

                {visiblePageNumbers[0] > 1 && (
                  <>
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          paginate(1);
                        }}
                        className="cursor-pointer"
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>
                    {visiblePageNumbers[0] > 2 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                  </>
                )}

                {visiblePageNumbers.map((number) => (
                  <PaginationItem key={number}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        paginate(number);
                      }}
                      isActive={safeCurrentPage === number}
                      className="cursor-pointer"
                    >
                      {number}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                {visiblePageNumbers[visiblePageNumbers.length - 1] < totalPages && (
                  <>
                    {visiblePageNumbers[visiblePageNumbers.length - 1] <
                      totalPages - 1 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          paginate(totalPages);
                        }}
                        className="cursor-pointer"
                      >
                        {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  </>
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNext();
                    }}
                    className={
                      safeCurrentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </div>
    </div>
  );
}
