"use client";

import { DepartmentTable } from "@/features/manage-organization/department-table";
import { PositionTable } from "@/features/manage-organization/position-table";
import { StructureTable } from "@/features/manage-organization/structure-table";
import { DepartmentView } from "@/features/manage-organization/department-view";
import { PositionView } from "@/features/manage-organization/position-view";
import { SupervisorView } from "@/features/manage-organization/supervisor-view";

export default function OrganizationPage() {
  return (
    <div className="px-4 py-8 sm:px-8 lg:px-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Structure</h1>
        <p className="text-sm text-muted-foreground">
          Manage departments, positions, and reporting structure.
        </p>
      </div>
      <div className="grid gap-6">
        <DepartmentTable />
        <DepartmentView />
        <PositionTable />
        <PositionView />
        <SupervisorView />
        <StructureTable />
      </div>
    </div>
  );
}
