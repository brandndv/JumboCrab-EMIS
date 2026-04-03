import AttendancePageContent from "@/features/manage-attendance/attendance-page-content";
import AttendanceProvider from "@/features/manage-attendance/attendance-provider";

export default function AttendancePage() {
  return (
    <AttendanceProvider>
      <AttendancePageContent />
    </AttendanceProvider>
  );
}
