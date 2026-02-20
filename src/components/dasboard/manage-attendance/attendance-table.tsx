"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCcw, RotateCcw, Clock4 } from "lucide-react";
import { TZ } from "@/lib/timezone";
import { listAttendance } from "@/actions/attendance/attendance-action";

type AttendanceRow = {
  id: string;
  workDate: string;
  status: string;
  expectedShiftId?: number | null;
  expectedShiftName?: string | null;
  scheduledStartMinutes?: number | null;
  scheduledEndMinutes?: number | null;
  actualInAt?: string | null;
  actualOutAt?: string | null;
  workedMinutes?: number | null;
  lateMinutes?: number | null;
  undertimeMinutes?: number | null;
  overtimeMinutesRaw?: number | null;
  breakMinutes?: number | null;
  breakCount?: number | null;
  employeeId: string;
  employee?: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null } | null;
    position?: { name: string | null } | null;
  } | null;
};

const pad = (num: number) => num.toString().padStart(2, "0");

const formatMinutesToTime = (
  minutes: number | null | undefined,
  asClock = true
) => {
  if (minutes == null) return "—";
  // Convert total minutes to HH:MM or "X hrs Y mins" label.
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (asClock) return `${pad(hrs)}:${pad(mins)}`;
  const parts = [];
  if (hrs) parts.push(`${hrs} hr${hrs === 1 ? "" : "s"}`);
  if (mins || !hrs) parts.push(`${mins} min${mins === 1 ? "" : "s"}`);
  return parts.join(" ");
};

const formatDate = (value: string) => {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
};

const formatMinutesToClock12 = (minutes: number) => {
  const totalHours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  // Map 0-23 to 12-hour clock (0 -> 12, 13 -> 1, etc.).
  const hrs12 = ((totalHours + 11) % 12) + 1;
  const ampm = totalHours >= 12 ? "PM" : "AM";
  return `${hrs12.toString().padStart(2, "0")}:${pad(mins)} ${ampm}`;
};

const toTzDate = (date: Date) =>
  // Force YYYY-MM-DD in the configured timezone for <input type="date" />.
  new Date(date).toLocaleDateString("en-CA", { timeZone: TZ });

const todayISO = () => toTzDate(new Date());

const sevenDaysAgoISO = () => {
  const d = new Date();
  // Subtract 7 days from today in local time before formatting in TZ.
  d.setDate(d.getDate() - 7);
  return toTzDate(d);
};

export function AttendanceHistoryTable() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState(sevenDaysAgoISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    // Refresh "now" so running shifts update once per minute.
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listAttendance({
        start: startDate,
        end: endDate,
        status: statusFilter || undefined,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to load attendance");
      }
      setRows(result.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load attendance"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return rows.filter((row) => {
      const empName = `${row.employee?.firstName || ""} ${
        row.employee?.lastName || ""
      }`
        .trim()
        .toLowerCase();
      const empCode = row.employee?.employeeCode?.toLowerCase() || "";
      const dept = row.employee?.department?.name?.toLowerCase() || "";
      const pos = row.employee?.position?.name?.toLowerCase() || "";
      if (!term) return true;
      return (
        empName.includes(term) ||
        empCode.includes(term) ||
        dept.includes(term) ||
        pos.includes(term) ||
        row.status.toLowerCase().includes(term)
      );
    });
  }, [rows, filter]);

  const resetDates = () => {
    setStartDate(sevenDaysAgoISO());
    setEndDate(todayISO());
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Attendance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Daily attendance with expected vs. actual times.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            className="w-full sm:w-64"
            placeholder="Search name, code, department"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            className="w-full sm:w-40 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All status</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="LATE">Late</option>
          </select>
          <Button
            variant="outline"
            size="icon"
            onClick={load}
            aria-label="Reload"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground" htmlFor="start">
              Start
            </label>
            <Input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground" htmlFor="end">
              End
            </label>
            <Input
              id="end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetDates}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" /> Reset range
          </Button>
          <Button onClick={load} size="sm" className="gap-2">
            <Clock4 className="h-4 w-4" /> Apply
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading attendance...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attendance records.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Breaks</TableHead>
                  <TableHead>Worked</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Undertime</TableHead>
                  <TableHead>Overtime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const key = `${row.employeeId}-${row.workDate}`;
                  const inAt = row.actualInAt ? new Date(row.actualInAt) : null;
                  const outAt = row.actualOutAt
                    ? new Date(row.actualOutAt)
                    : null;
                  const runningMinutes =
                    inAt && !outAt
                      ? Math.max(
                          0,
                          // Elapsed minutes since clock-in when shift is still open.
                          Math.round((now.getTime() - inAt.getTime()) / 60000)
                        )
                      : null;
                  const workedLabel =
                    runningMinutes != null
                      ? `${formatMinutesToTime(
                          runningMinutes,
                          false
                        )} (running)`
                      : row.workedMinutes != null
                      // Use stored total minutes when shift is closed.
                      ? formatMinutesToTime(row.workedMinutes, false)
                      : "—";
                  return (
                    <TableRow key={key}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(row.workDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {row.employee?.firstName} {row.employee?.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.employee?.employeeCode}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.employee?.department?.name || "—"} ·{" "}
                            {row.employee?.position?.name || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                      <Badge
                        variant={
                          row.status === "PRESENT"
                            ? "success"
                            : row.status === "LATE"
                            ? "warning"
                            : row.status === "INCOMPLETE"
                            ? "info"
                            : row.status === "ABSENT"
                            ? "destructive"
                            : "outline"
                        }
                        className="uppercase tracking-wide"
                      >
                        {row.status}
                      </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.scheduledStartMinutes != null &&
                        row.scheduledEndMinutes != null ? (
                          <div className="flex flex-col">
                            <span>
                              {formatMinutesToClock12(
                                row.scheduledStartMinutes
                              )}{" "}
                              -{" "}
                              {formatMinutesToClock12(row.scheduledEndMinutes)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {row.expectedShiftName || "Expected shift"}
                            </span>
                          </div>
                        ) : row.expectedShiftName ? (
                          <span>{row.expectedShiftName}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(row.actualInAt)} -{" "}
                        {formatDateTime(row.actualOutAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.breakMinutes != null
                          ? `${formatMinutesToTime(row.breakMinutes, false)}${
                              row.breakCount ? ` (${row.breakCount}x)` : ""
                            }`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {workedLabel}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.lateMinutes != null
                          ? formatMinutesToTime(row.lateMinutes, false)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.undertimeMinutes != null
                          ? formatMinutesToTime(row.undertimeMinutes, false)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.overtimeMinutesRaw != null
                          ? formatMinutesToTime(row.overtimeMinutesRaw, false)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
