// page.tsx
"use client";

import { EmployeesProvider } from "@/components/dasboard/manage-empoyees/employees-provider";
import EmployeesTable from "@/components/dasboard/manage-empoyees/employees-table";
import { Employee } from "@/lib/validations/employees"; // Import the Employee type

export default function EmployeesPage() {
  // Initialize with proper type
  const employees: Employee[] = [];

  return (
    <div className="px-20 py-10">
      <EmployeesProvider>
        <EmployeesTable employees={employees} />
      </EmployeesProvider>
    </div>
  );
}
