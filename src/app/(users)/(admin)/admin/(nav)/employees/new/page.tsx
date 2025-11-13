'use client';

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import EmployeeForm from "@/components/dasboard/manage-empoyees/employee-form";

export default function AddEmployeePage() {
  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium">Add New Employee</h3>
          <p className="text-sm text-muted-foreground">
            Add a new employee to the system
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/admin/employees">
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </Link>
        </Button>
      </div>
      
      <EmployeeForm employeeId={null} mode="create" />
    </div>
  );
}
