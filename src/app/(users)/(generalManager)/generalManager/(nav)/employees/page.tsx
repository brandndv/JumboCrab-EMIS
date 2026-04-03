"use client";

import EmployeesPageContent from "@/features/manage-employees/employees-page-content";
import EmployeesProvider from "@/features/manage-employees/employees-provider";

export default function EmployeesPage() {
  return (
    <EmployeesProvider>
      <EmployeesPageContent />
    </EmployeesProvider>
  );
}
