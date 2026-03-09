"use client";

import { AttendanceLocks } from "@/components/dasboard/manage-attendance/attendance-locks";

export default function AttendanceLocksPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Attendance Locks</h1>
        <p className="text-sm text-muted-foreground">
          Control lock and unlock states by date range and employee exceptions.
        </p>
      </div>
      <AttendanceLocks />
    </div>
  );
}
