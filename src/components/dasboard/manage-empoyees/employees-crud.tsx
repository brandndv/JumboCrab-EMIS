"use client";

import { useState } from "react";
import { MoreHorizontalIcon, Pencil, Archive, Trash2 } from "lucide-react";
import { Employee } from "@/lib/validations/employees";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EmployeesActionsProps {
  employee: Employee;
  onEdit: (employeeId: string) => void;
  onArchive: (employee: Employee) => void;
  onUnarchive?: (employee: Employee) => void;
  onDelete?: (employee: Employee) => void;
  isArchivedView?: boolean;
}

export function EmployeesActions({
  employee,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  isArchivedView = false,
}: EmployeesActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontalIcon className="h-4 w-4" />
          <span className="sr-only">More options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {!isArchivedView ? (
          <>
            <DropdownMenuItem
              onClick={() => {
                if (!employee.employeeId) {
                  console.error("Cannot edit: Employee ID is missing");
                  return;
                }
                onEdit(employee.employeeId);
              }}
              disabled={!employee.employeeId}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => onArchive(employee)}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={() => onUnarchive?.(employee)}>
              <Archive className="mr-2 h-4 w-4 rotate-180" />
              Unarchive
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => onDelete?.(employee)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
