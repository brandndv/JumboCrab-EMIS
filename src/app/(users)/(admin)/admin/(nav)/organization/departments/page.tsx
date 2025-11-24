"use client";

import { DepartmentTable } from "@/components/dasboard/manage-organization/department-table";
import { DepartmentView } from "@/components/dasboard/manage-organization/department-view";

export default function DepartmentsPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Departments</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage departments used across the organization.
        </p>
      </div>
      <DepartmentTable />
      <DepartmentView />
    </div>
  );
}
