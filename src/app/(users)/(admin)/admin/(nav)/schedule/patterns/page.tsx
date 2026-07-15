"use client";

import { ScheduleBoard } from "@/features/manage-attendance/schedule-board";

export default function SchedulePatternsPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Weekly Schedule Planner</h1>
        <p className="text-sm text-muted-foreground">
          Build weekly employee schedules, compare with last week, and save only changed employees.
        </p>
      </div>
      <ScheduleBoard mode="patterns" />
    </div>
  );
}
