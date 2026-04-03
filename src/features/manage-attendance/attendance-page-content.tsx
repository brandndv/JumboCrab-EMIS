import { DailyAttendance } from "@/features/manage-attendance/daily-attendance";

export default function AttendancePageContent() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Track daily attendance and reconcile punches.
        </p>
      </div>
      <DailyAttendance />
    </div>
  );
}
