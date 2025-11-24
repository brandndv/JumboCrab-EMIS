"use client";

import { PositionTable } from "@/components/dasboard/manage-organization/position-table";
import { PositionView } from "@/components/dasboard/manage-organization/position-view";

export default function PositionsPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Positions</h1>
        <p className="text-sm text-muted-foreground">
          Define roles and link them to departments.
        </p>
      </div>
      <PositionTable />
      <PositionView />
    </div>
  );
}
