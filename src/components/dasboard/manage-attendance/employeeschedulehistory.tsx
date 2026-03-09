"use client";

import { useEffect, useMemo, useState } from "react";
import { listAttendance } from "@/actions/attendance/attendance-action";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import type { AttendanceRow } from "@/hooks/use-attendance";
import { CalendarRange, Table2 } from "lucide-react";
import { TZ } from "@/lib/timezone";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const getNowInTz = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));

const toIsoDate = (date: Date) =>
  date.toLocaleDateString("en-CA", { timeZone: TZ });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    timeZone: TZ,
    month: "short",
    day: "numeric",
  });

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(undefined, {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatMinutesToDuration = (minutes: number | null | undefined) => {
  if (minutes == null) return "—";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min${mins === 1 ? "" : "s"}`;
  if (mins === 0) return `${hrs} hr${hrs === 1 ? "" : "s"}`;
  return `${hrs} hr${hrs === 1 ? "" : "s"} ${mins} min${mins === 1 ? "" : "s"}`;
};

const toDateKey = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });

const badgeVariantForStatus = (status?: string | null) => {
  if (status === "PRESENT") return "success" as const;
  if (status === "LATE") return "warning" as const;
  if (status === "INCOMPLETE") return "info" as const;
  if (status === "ABSENT") return "destructive" as const;
  return "outline" as const;
};

const buildMonthRange = (year: number, month: number) => {
  const startDate = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0));
  return {
    start: toIsoDate(startDate),
    end: toIsoDate(endDate),
    dayCount: endDate.getUTCDate(),
  };
};

const EmployeeScheduleHistory = () => {
  const { user, employee, loading, error } = useSession();
  const nowInTz = useMemo(() => getNowInTz(), []);
  const currentYear = nowInTz.getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(
    nowInTz.getMonth(),
  );
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, index) => currentYear - 4 + index),
    [currentYear],
  );

  const range = useMemo(
    () => buildMonthRange(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  );

  useEffect(() => {
    const employeeId = employee?.employeeId;
    if (!employeeId) {
      setRows([]);
      return;
    }

    let mounted = true;
    const load = async () => {
      try {
        setRowsLoading(true);
        setRowsError(null);
        const result = await listAttendance({
          employeeId,
          start: range.start,
          end: range.end,
        });
        if (!result.success) {
          throw new Error(result.error || "Failed to load attendance history");
        }
        if (!mounted) return;
        setRows((result.data ?? []) as AttendanceRow[]);
      } catch (err) {
        if (!mounted) return;
        setRowsError(
          err instanceof Error
            ? err.message
            : "Failed to load attendance history",
        );
      } finally {
        if (mounted) setRowsLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [employee?.employeeId, range.end, range.start]);

  const rowsByDate = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    rows.forEach((row) => map.set(toDateKey(row.workDate), row));
    return map;
  }, [rows]);

  const completeDateRows = useMemo(() => {
    return Array.from({ length: range.dayCount }, (_, index) => {
      const dayNumber = index + 1;
      const date = new Date(
        Date.UTC(selectedYear, selectedMonth, dayNumber, 12, 0, 0),
      );
      const dateKey = toIsoDate(date);
      return {
        dateKey,
        row: rowsByDate.get(dateKey),
      };
    });
  }, [range.dayCount, rowsByDate, selectedMonth, selectedYear]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Failed to load session</div>;
  if (!user) return <div>No session</div>;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">Attendance History</h1>
        <p className="text-sm text-muted-foreground">
          View your attendance by month and year.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Table2 className="h-5 w-5" />
              Monthly Attendance
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Showing {monthNames[selectedMonth]} {selectedYear}
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[auto_auto_auto] sm:items-center">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <CalendarRange className="h-4 w-4" />
              <span className="text-sm">Period</span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {monthNames.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {rowsError ? (
            <p className="text-sm text-destructive">{rowsError}</p>
          ) : rowsLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading attendance...
            </p>
          ) : completeDateRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attendance records found for this period.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {/* <TableHead>Shift</TableHead> */}
                    <TableHead>Time in</TableHead>
                    <TableHead>Break start</TableHead>
                    <TableHead>Break end</TableHead>
                    <TableHead>Time out</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Over/Under</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Work Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completeDateRows.map(({ dateKey, row }) => (
                    <TableRow key={row?.id ?? `date-${dateKey}`}>
                      <TableCell>{formatDate(dateKey)}</TableCell>
                      {/* <TableCell className="text-sm text-muted-foreground">
                        {row?.expectedShiftName || "—"}
                      </TableCell> */}
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(row?.actualInAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(row?.breakStartAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(row?.breakEndAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(row?.actualOutAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatMinutesToDuration(row?.lateMinutes)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row?.overtimeMinutesRaw != null &&
                        row.overtimeMinutesRaw > 0
                          ? `${formatMinutesToDuration(row.overtimeMinutesRaw)} OT`
                          : row?.undertimeMinutes != null &&
                              row.undertimeMinutes > 0
                            ? `${formatMinutesToDuration(row.undertimeMinutes)} UT`
                            : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={badgeVariantForStatus(row?.status)}
                            className="w-fit uppercase tracking-wide"
                          >
                            {row?.status || "NO RECORD"}
                          </Badge>
                          {row?.forgotToTimeOut ? (
                            <Badge
                              className="w-fit uppercase tracking-wide"
                              variant="destructive"
                            >
                              Forgot time out
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row?.netWorkedHoursAndMinutes ??
                          row?.workedHoursAndMinutes ??
                          formatMinutesToDuration(
                            row?.netWorkedMinutes ?? row?.workedMinutes,
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeScheduleHistory;
