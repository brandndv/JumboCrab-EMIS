import { AttendanceSecuritySettingsPage } from "@/features/manage-attendance/attendance-security-settings-page";

export default function AttendanceSettingsPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Attendance Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure attendance anti-cheating rules, review behavior, and device checks.
        </p>
      </div>
      <AttendanceSecuritySettingsPage />
    </div>
  );
}
