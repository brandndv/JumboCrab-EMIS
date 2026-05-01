import AttendancePageContent from "@/features/manage-attendance/attendance-page-content";
import AttendanceProvider from "@/features/manage-attendance/attendance-provider";
import { getCurrentPlainSession } from "@/lib/current-session";

export default async function SupervisorAttendancePage() {
  const session = await getCurrentPlainSession();

  return (
    <AttendanceProvider supervisorUserId={session?.userId ?? undefined}>
      <AttendancePageContent />
    </AttendanceProvider>
  );
}
