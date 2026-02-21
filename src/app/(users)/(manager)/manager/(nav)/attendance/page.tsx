import AttendancePageContent from "@/components/dasboard/manage-attendance/attendance-page-content";
import AttendanceProvider from "@/components/dasboard/manage-attendance/attendance-provider";

export default function AttendancePage() {
  return (
    <AttendanceProvider>
      <AttendancePageContent />
    </AttendanceProvider>
  );
}
