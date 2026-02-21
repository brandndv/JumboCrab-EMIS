"use client";

import { PositionTable } from "@/components/dasboard/manage-organization/position-table";
import { PositionView } from "@/components/dasboard/manage-organization/position-view";

export default function PositionsPage() {
  return (
    <div className="px-4 py-8 sm:px-8 lg:px-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Positions</h1>
        <p className="text-sm text-muted-foreground">
          Define roles and link them to departments.
        </p>
      </div>
      <div className="grid gap-6">
        <PositionTable />
        <PositionView />
      </div>
    </div>
  );
}
