"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Employee } from "@/lib/validations/employees";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { EmployeesActions } from "./employees-crud";
import { Separator } from "@/components/ui/separator";
import { useEmployees } from "./employees-provider";

export default function EmployeesCards({
  employees,
}: {
  employees: Employee[];
}) {
  const router = useRouter();
  const { refreshEmployees, showArchived } = useEmployees();
  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  // Handle view employee
  const handleViewEmployee = (employeeId: string | undefined) => {
    if (!employeeId) {
      console.error("No employee ID provided for view");
      return;
    }
    router.push(`/admin/employees/${employeeId}/view`);
  };

  // Handle edit employee
  const handleEditEmployee = (employeeId: string | undefined) => {
    if (!employeeId) {
      console.error("No employee ID provided for edit");
      return;
    }
    router.push(`/admin/employees/${employeeId}/edit`);
  };

  // Handle archive employee
  const handleArchiveClick = (employee: Employee) => {
    if (!employee.employeeId) return;
    const confirmed = window.confirm(
      `Archive ${employee.firstName ?? ""} ${employee.lastName ?? ""}?`
    );
    if (!confirmed) return;

    fetch(`/api/employees/${employee.employeeId}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: true }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to archive employee");
        }
        await refreshEmployees();
      })
      .catch((err) => {
        console.error("Archive failed:", err);
        alert(
          err instanceof Error ? err.message : "Failed to archive employee"
        );
      });
  };

  const handleUnarchiveClick = (employee: Employee) => {
    if (!employee.employeeId) return;
    fetch(`/api/employees/${employee.employeeId}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: false }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to unarchive employee");
        }
        await refreshEmployees();
      })
      .catch((err) => {
        console.error("Unarchive failed:", err);
        alert(
          err instanceof Error ? err.message : "Failed to unarchive employee"
        );
      });
  };

  const handleDeleteClick = (employee: Employee) => {
    if (!employee.employeeId) return;
    const confirmed = window.confirm(
      `Permanently delete ${employee.firstName ?? ""} ${
        employee.lastName ?? ""
      }?`
    );
    if (!confirmed) return;

    fetch(`/api/employees/${employee.employeeId}`, { method: "DELETE" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to delete employee");
        }
        await refreshEmployees();
      })
      .catch((err) => {
        console.error("Delete failed:", err);
        alert(err instanceof Error ? err.message : "Failed to delete employee");
      });
  };

  // Calculate pagination
  const totalPages = Math.ceil(employees.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = employees.slice(indexOfFirstItem, indexOfLastItem);

  // Handle page change
  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: "smooth" }); // Optional: Scroll to top on page change
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPageButtons = 5; // Maximum number of page buttons to show
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(startPage + maxPageButtons - 1, totalPages);

    if (endPage - startPage + 1 < maxPageButtons) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return pageNumbers;
  };

  // Handle previous and next page
  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full">
      {/* Grid: auto-fill with a min card width so cards don't shrink too much. Tweak 280px as needed. */}
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
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span className="font-semibold text-base">
                      {employee.firstName?.charAt(0)}
                      {employee.lastName?.charAt(0)}
                    </span>
                  </div>
                  {/* Name/position: allow two lines for name to avoid over-truncation */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-foreground line-clamp-2">
                      {employee.firstName} {employee.lastName}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {typeof employee.position === "string"
                        ? employee.position || "No position"
                        : (employee.position as any)?.name || "No position"}
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
                      : (employee.department as any)?.name || "No department"}
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

      <Pagination className="m-0 mt-5">
        <PaginationContent>
          {/* Back to Start Button - Shows when current page > 3 */}
          {currentPage > 3 && (
            <PaginationItem>
              <PaginationLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  paginate(1);
                }}
                className="cursor-pointer"
              >
                «
              </PaginationLink>
            </PaginationItem>
          )}

          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handlePrevious();
              }}
              className={
                currentPage === 1
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer"
              }
            />
          </PaginationItem>

          {getPageNumbers().map((number) => (
            <PaginationItem key={number}>
              <PaginationLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  paginate(number);
                }}
                isActive={currentPage === number}
                className="cursor-pointer"
              >
                {number}
              </PaginationLink>
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleNext();
              }}
              className={
                currentPage === totalPages
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer"
              }
            />
          </PaginationItem>

          {/* Go to End Button - Shows when current page < totalPages - 2 */}
          {currentPage < totalPages - 2 && (
            <PaginationItem>
              <PaginationLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  paginate(totalPages);
                }}
                className="cursor-pointer"
              >
                »
              </PaginationLink>
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </div>
  );
}
