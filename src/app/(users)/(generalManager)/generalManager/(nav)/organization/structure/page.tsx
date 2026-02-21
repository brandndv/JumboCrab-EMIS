"use client";

import { StructureTable } from "@/components/dasboard/manage-organization/structure-table";
import { SupervisorView } from "@/components/dasboard/manage-organization/supervisor-view";

export default function StructurePage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Structure</h1>
        <p className="text-sm text-muted-foreground">
          View reporting lines and supervisor relationships.
        </p>
      </div>
      <SupervisorView />
      <StructureTable />
    </div>
  );
}
