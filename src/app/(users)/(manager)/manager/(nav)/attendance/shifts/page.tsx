"use client";

import { ShiftsManager } from "@/components/dasboard/manage-attendance/shifts-manager";

export default function ShiftsPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Shifts</h1>
        <p className="text-sm text-muted-foreground">
          Create and view shifts available for scheduling.
        </p>
      </div>
      <ShiftsManager />
    </div>
  );
}
