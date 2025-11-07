"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { Employee, SUFFIX } from "@/lib/validations/employees";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmployeesActions } from "./employees-crud";
import { Separator } from "@/components/ui/separator";

// ========== PAGINATION LOGIC ========= //

export default function EmployeesTable({
  employees,
}: {
  employees: Employee[];
}) {
  const router = useRouter();
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
    // TODO: Implement archive functionality with confirmation dialog
    console.log("Archive employee:", employee.id);
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

  const handleView = (employee: Employee) => {
    router.push(`/admin/employees/${employee.id}`);
  };

  const handleEdit = (employee: Employee) => {
    router.push(`/admin/employees/${employee.id}/edit`);
  };

  const handleArchive = (employee: Employee) => {
    handleArchiveClick(employee);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
        {currentItems.map((employee) => (
          <div
            key={employee.id}
            className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow flex flex-col h-[280px]"
          >
            <div className="flex-1 flex flex-col">
              {/* Header with Avatar and Name */}
              <div className="flex justify-between items-start w-full">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-blue-600 font-medium text-base">
                      {employee.firstName?.charAt(0)}
                      {employee.lastName?.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {employee.firstName} {employee.lastName}
                    </h3>
                    <p className="text-xs text-gray-600 truncate">
                      {employee.position || "No position"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <EmployeesActions
                    employee={employee}
                    onEdit={handleEditEmployee}
                    onArchive={handleArchiveClick}
                  />
                </div>
              </div>
              <Separator className="my-2" />

              {/* Employee Info */}
              <div className="flex-1 min-w-0 space-y-3">
                {employee.description && (
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                      {employee.description}
                    </p>
                  </div>
                )}
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 text-gray-400"
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
                    {employee.department || "No department"}
                  </div>
                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 text-gray-400 shrink-0"
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
                      className="truncate max-w-[180px]"
                      title={employee.email || ""}
                    >
                      {employee.email || "No email"}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 text-gray-400"
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
                </div>
              </div>
              {/* Status and Preview */}
              <Separator className="my-2" />
              <div>
                <div className="flex justify-between items-center w-full">
                  <div
                    className={`mr-auto px-3 py-1 rounded-full text-xs font-medium ${
                      employee.currentStatus === "ACTIVE"
                        ? "bg-green-100 text-green-800"
                        : employee.currentStatus === "ON_LEAVE"
                        ? "bg-yellow-100 text-yellow-800"
                        : employee.currentStatus === "VACATION"
                        ? "bg-blue-100 text-blue-800"
                        : employee.currentStatus === "SICK_LEAVE"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {employee.currentStatus
                      ? employee.currentStatus.replace("_", " ")
                      : "Inactive"}
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        employee.id && handleViewEmployee(employee.id)
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
