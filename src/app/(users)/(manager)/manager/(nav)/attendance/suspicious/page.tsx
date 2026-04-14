import { SuspiciousLogsPage } from "@/features/manage-attendance/suspicious-logs-page";

export default function SuspiciousAttendanceLogsPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Suspicious Logs</h1>
        <p className="text-sm text-muted-foreground">
          Review attendance punches flagged by device, fingerprint, or location rules.
        </p>
      </div>
      <SuspiciousLogsPage />
    </div>
  );
}
