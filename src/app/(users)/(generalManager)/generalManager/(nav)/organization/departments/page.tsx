"use client";

import { DepartmentTable } from "@/components/dasboard/manage-organization/department-table";
import { DepartmentView } from "@/components/dasboard/manage-organization/department-view";

export default function DepartmentsPage() {
  return (
    <div className="px-4 py-8 sm:px-8 lg:px-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Departments</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage departments used across the organization.
        </p>
      </div>
      <div className="grid gap-6">
        <DepartmentTable />
        <DepartmentView />
      </div>
    </div>
  );
}
