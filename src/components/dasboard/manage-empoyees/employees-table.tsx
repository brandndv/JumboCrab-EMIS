"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { SUFFIX } from "@/lib/validations/employees";
// import { EmployeeDialog } from "./employee-dialog";
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
import { Employee } from "@/lib/validations/employees";
import { EmployeesActions } from "./employees-crud";
import {
  updateEmployee,
  deleteEmployee,
} from "../../../actions/employees-action";
import { EmployeeDialog } from "./employee-dialog";

// ========== PAGINATION LOGIC ========= //

export default function EmployeesTable({
  employees,
}: {
  employees: Employee[];
}) {
  // Dialog state
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    mode: "view" | "edit" | "archive" | null;
    employee: Employee | null;
  }>({
    isOpen: false,
    mode: null,
    employee: null,
  });
  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3; // You can adjust this number

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
    setDialogState({
      isOpen: true,
      mode: "view",
      employee,
    });
  };

  const handleEdit = (employee: Employee) => {
    setDialogState({
      isOpen: true,
      mode: "edit",
      employee,
    });
  };

  const handleArchive = (employee: Employee) => {
    setDialogState({
      isOpen: true,
      mode: "archive",
      employee,
    });
  };

  const handleConfirmArchive = async () => {
    if (!dialogState.employee?.id) {
      console.error("Error: No employee ID provided for deletion");
      return;
    }

    try {
      // Call the server action
      const result = await deleteEmployee(dialogState.employee.id);

      if (result?.error) {
        throw new Error(result.error);
      }

      // Refresh the employee list
      window.location.reload();
    } catch (error) {
      console.error("Error archiving employee:", error);
      // You might want to show an error message to the user
    } finally {
      handleDialogClose();
    }
  };

  const handleDialogClose = () => {
    setDialogState({
      isOpen: false,
      mode: null,
      employee: null,
    });
  };

  const handleSave = async (updatedEmployee: Employee) => {
    try {
      if (!updatedEmployee.id) {
        console.error("Error: No employee ID provided for update");
        return;
      }

      // Create a new object with all fields from updatedEmployee
      const employeeData = {
        id: updatedEmployee.id,
        // Basic info
        employeeCode: updatedEmployee.employeeCode,
        firstName: updatedEmployee.firstName,
        middleName: updatedEmployee.middleName,
        lastName: updatedEmployee.lastName,
        // Include nationality
        nationality: updatedEmployee.nationality || undefined,
        // Enums
        sex: updatedEmployee.sex,
        civilStatus: updatedEmployee.civilStatus,
        employmentStatus: updatedEmployee.employmentStatus,
        currentStatus: updatedEmployee.currentStatus,
        suffix: updatedEmployee.suffix || undefined,
        // Dates - using undefined instead of null to match the expected type
        birthdate: updatedEmployee.birthdate
          ? new Date(updatedEmployee.birthdate)
          : undefined,
        startDate: updatedEmployee.startDate
          ? new Date(updatedEmployee.startDate)
          : undefined,
        endDate: updatedEmployee.endDate
          ? new Date(updatedEmployee.endDate)
          : undefined,
        // Other fields - using undefined instead of null to match the expected type
        address: updatedEmployee.address || undefined,
        img: updatedEmployee.img || undefined,
        position: updatedEmployee.position || undefined,
        department: updatedEmployee.department || undefined,
        email: updatedEmployee.email || undefined,
        phone: updatedEmployee.phone || undefined,
      };

      console.log("Saving employee data:", employeeData); // Debug log

      const result = await updateEmployee(employeeData);

      if (result?.error) {
        throw new Error(result.error);
      }

      // Use router.refresh() instead of window.location.reload() in Next.js
      window.location.reload();
    } catch (error) {
      console.error("Error updating employee:", error);
      // Consider adding toast or alert here
    } finally {
      handleDialogClose();
    }
  };

  return (
    <div className="w-full">
      <EmployeeDialog
        employee={dialogState.employee}
        mode={dialogState.mode}
        onClose={handleDialogClose}
        onSave={handleSave}
        onArchive={handleConfirmArchive}
      />
      <div className="w-full border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Current Status</TableHead>
              <TableHead>Employment Status</TableHead>
              <TableHead>Start & End Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentItems.map((employee) => (
              <TableRow key={employee.id} className="odd:bg-muted/50">
                <TableCell className="pl-4">{employee.employeeCode}</TableCell>
                <TableCell className="font-medium">{`${employee.firstName} ${
                  employee.lastName
                } ${employee.suffix ? `${employee.suffix}` : ""}`}</TableCell>
                <TableCell>{employee.position}</TableCell>
                <TableCell>{employee.department}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
                    {employee.currentStatus === "ACTIVE"
                      ? "Active"
                      : employee.currentStatus === "ON_LEAVE"
                      ? "On Leave"
                      : employee.currentStatus === "VACATION"
                      ? "On Vacation"
                      : employee.currentStatus === "SICK_LEAVE"
                      ? "Sick Leave"
                      : "Inactive"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {employee.employmentStatus === "REGULAR"
                      ? "Regular"
                      : employee.employmentStatus === "PROBATIONARY"
                      ? "Probationary"
                      : "Training"}
                  </span>
                </TableCell>
                <TableCell>
                  {new Date(employee.startDate).toLocaleDateString()}
                  {employee.endDate
                    ? ` - ${new Date(employee.endDate).toLocaleDateString()}`
                    : " - Present"}
                </TableCell>
                <TableCell>
                  <EmployeesActions
                    employee={employee}
                    onView={handleView}
                    onEdit={handleEdit}
                    onArchive={handleArchive}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination className="m-0 mt-5">
        <PaginationContent>
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
        </PaginationContent>
      </Pagination>
    </div>
  );
}
