"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { listAttendance } from "@/actions/attendance/attendance-action";
import type { AttendanceRow } from "@/hooks/use-attendance";
import { Table2 } from "lucide-react";
import { TZ } from "@/lib/timezone";

type BimonthlyPeriod = "first" | "second";
type BimonthlyOption = {
  value: BimonthlyPeriod;
  label: string;
  start: string;
  end: string;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0]?.slice(0, 1).toUpperCase() ?? "U";
  return `${parts[0]?.slice(0, 1) ?? ""}${parts[parts.length - 1]?.slice(0, 1) ?? ""}`.toUpperCase();
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    timeZone: TZ,
    day: "numeric",
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleTimeString(undefined, {
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

const toTzIsoDate = (date: Date) =>
  date.toLocaleDateString("en-CA", { timeZone: TZ });

const toTzDateKey = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });

const parseIsoDateAtNoonUtc = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

const toFullDateLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const buildCurrentMonthBimonthlyOptions = (): {
  options: BimonthlyOption[];
  defaultPeriod: BimonthlyPeriod;
} => {
  const nowInTz = new Date(
    new Date().toLocaleString("en-US", { timeZone: TZ }),
  );
  const year = nowInTz.getFullYear();
  const month = nowInTz.getMonth();
  const day = nowInTz.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const makeDate = (targetDay: number) =>
    new Date(Date.UTC(year, month, targetDay, 12, 0, 0));

  const firstStart = makeDate(1);
  const firstEnd = makeDate(15);
  const secondStart = makeDate(16);
  const secondEnd = makeDate(lastDay);

  const options: BimonthlyOption[] = [
    {
      value: "first",
      label: `1st half: ${toFullDateLabel(firstStart)} - ${toFullDateLabel(firstEnd)}`,
      start: toTzIsoDate(firstStart),
      end: toTzIsoDate(firstEnd),
    },
    {
      value: "second",
      label: `2nd half: ${toFullDateLabel(secondStart)} - ${toFullDateLabel(secondEnd)}`,
      start: toTzIsoDate(secondStart),
      end: toTzIsoDate(secondEnd),
    },
  ];

  return { options, defaultPeriod: day <= 15 ? "first" : "second" };
};

const EmployeeAttendance = () => {
  const { user, employee, loading, error } = useSession();
  const [period, setPeriod] = useState<BimonthlyPeriod>("first");
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const { options: periodOptions, defaultPeriod } = useMemo(
    () => buildCurrentMonthBimonthlyOptions(),
    [],
  );

  useEffect(() => {
    setPeriod(defaultPeriod);
  }, [defaultPeriod]);
  const employeeId = employee?.employeeId;
  const selectedRange =
    periodOptions.find((opt) => opt.value === period) ?? periodOptions[0];

  useEffect(() => {
    const loadBimonthlyAttendance = async () => {
      if (!employeeId || !selectedRange) {
        setRows([]);
        return;
      }
      try {
        setRowsLoading(true);
        setRowsError(null);
        const result = await listAttendance({
          employeeId,
          start: selectedRange.start,
          end: selectedRange.end,
        });
        if (!result.success) {
          throw new Error(result.error || "Failed to load attendance");
        }
        setRows((result.data ?? []) as AttendanceRow[]);
      } catch (err) {
        setRowsError(
          err instanceof Error ? err.message : "Failed to load attendance",
        );
      } finally {
        setRowsLoading(false);
      }
    };

    void loadBimonthlyAttendance();
  }, [employeeId, selectedRange]);

  const rowsByDate = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    rows.forEach((row) => {
      map.set(toTzDateKey(row.workDate), row);
    });
    return map;
  }, [rows]);

  const completeDateRows = useMemo(() => {
    if (!selectedRange) return [];
    const start = parseIsoDateAtNoonUtc(selectedRange.start);
    const end = parseIsoDateAtNoonUtc(selectedRange.end);
    if (!start || !end) return [];

    const result: Array<{ dateKey: string; row?: AttendanceRow }> = [];
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const dateKey = toTzIsoDate(cursor);
      result.push({ dateKey, row: rowsByDate.get(dateKey) });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return result;
  }, [selectedRange, rowsByDate]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Failed to load session</div>;
  if (!user) return <div>No session</div>;

  const displayName =
    [employee?.firstName, employee?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    user.username ||
    "User";
  const avatarSrc = user.image || employee?.img || undefined;
  const positionLabel =
    typeof employee?.position === "string"
      ? employee.position
      : employee?.positionId || "No position assigned";
  const departmentLabel =
    typeof employee?.department === "string"
      ? employee.department
      : "No department assigned";
  const employeeCode = employee?.employeeCode || "No employee code";
  const profileMeta = `${positionLabel} • ${departmentLabel}`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">My Attendance</h1>
        <p className="text-sm text-muted-foreground">Track daily attendance</p>
      </div>
      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="bg-muted/20 p-4 sm:p-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <Avatar className="h-14 w-14 shrink-0 ring-2 ring-primary/15 sm:h-16 sm:w-16">
              {avatarSrc && <AvatarImage src={avatarSrc} alt={displayName} />}
              <AvatarFallback className="bg-primary/10 text-xl font-semibold uppercase text-primary">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="max-w-full truncate text-xl font-semibold leading-tight sm:text-2xl">
                  {displayName}
                </h2>
                <span className="inline-flex w-fit rounded-full border border-border bg-orange-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {employeeCode}
                </span>
              </div>
              <p className="truncate text-sm text-muted-foreground">{profileMeta}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Table2 className="h-5 w-5" />
              Current Month Bi-monthly Attendance
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Showing attendance for the selected half of the current month.
            </p>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[24rem]">
            <div className="grid grid-cols-2 rounded-lg border bg-muted/30 p-1">
              {periodOptions.map((option) => {
                const active = period === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPeriod(option.value)}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.value === "first" ? "1st Half" : "2nd Half"}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground sm:text-right">
              {selectedRange?.label}
            </p>
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
              No dates in selected range.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>

                    {/* <TableHead>Expected</TableHead> */}
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
                            variant={
                              row?.status === "PRESENT"
                                ? "success"
                                : row?.status === "LATE"
                                  ? "warning"
                                  : row?.status === "INCOMPLETE"
                                    ? "info"
                                    : row?.status === "ABSENT"
                                      ? "destructive"
                                      : "outline"
                            }
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

export default EmployeeAttendance;
