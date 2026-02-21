"use client";

import EmployeesPageContent from "@/components/dasboard/manage-empoyees/employees-page-content";
import EmployeesProvider from "@/components/dasboard/manage-empoyees/employees-provider";

export default function EmployeesPage() {
  return (
    <EmployeesProvider>
      <EmployeesPageContent />
    </EmployeesProvider>
  );
}
