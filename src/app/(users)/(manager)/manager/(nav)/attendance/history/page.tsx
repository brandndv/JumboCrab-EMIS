"use client";

import { AttendanceHistoryTable } from "@/components/dasboard/manage-attendance/attendance-table";

export default function AttendanceHistoryPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Attendance History</h1>
        <p className="text-sm text-muted-foreground">
          Browse historical attendance records and recompute days as needed.
        </p>
      </div>
      <AttendanceHistoryTable />
    </div>
  );
}
