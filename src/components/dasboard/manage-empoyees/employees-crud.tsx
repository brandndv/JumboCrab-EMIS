"use client";

import { useState } from "react";
import { MoreHorizontalIcon, Eye, Pencil, Archive } from "lucide-react";
import { Employee } from "@/lib/validations/employees";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface EmployeesActionsProps {
  employee: Employee;
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onArchive: (employee: Employee) => void;
}

export function EmployeesActions({
  employee,
  onView,
  onEdit,
  onArchive,
}: EmployeesActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onView(employee)}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(employee)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-600"
          onClick={() => onArchive(employee)}
        >
          <Archive className="mr-2 h-4 w-4" />
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
