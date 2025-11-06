"use client";

import { useState } from "react";
import { MoreHorizontalIcon, Pencil, Archive } from "lucide-react";
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
}

export function EmployeesActions({
  employee,
  onEdit,
  onArchive,
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
        <DropdownMenuItem 
          onClick={() => {
            if (employee.id) {
              onEdit(employee.id);
            } else {
              console.error('Cannot edit: Employee ID is missing');
            }
          }}
          disabled={!employee.id}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
