"use client";

import { ScheduleBoard } from "@/components/dasboard/manage-attendance/schedule-board";

export default function AttendancePatternsPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Weekly Patterns</h1>
        <p className="text-sm text-muted-foreground">
          Manage weekly shift patterns and assignments.
        </p>
      </div>
      <ScheduleBoard mode="patterns" />
    </div>
  );
}
