"use client";

import { useEffect, useMemo, useState } from "react";
import { addWeeks, format, startOfWeek } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { getSupervisorTeamWeekSchedule } from "@/actions/schedule/schedule-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TZ } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type TeamScheduleShift = {
  id: number;
  code: string;
  name: string;
  colorHex?: string | null;
  isDayOff?: boolean;
  startMinutes: number;
  endMinutes: number;
  spansMidnight: boolean;
};

type TeamScheduleCell = {
  employeeId: string;
  date: string;
  shift: TeamScheduleShift | null;
  source: "override" | "weekly_schedule" | "none";
  leave: {
    requestId: string | null;
    leaveType: "VACATION" | "SICK" | "PERSONAL" | "EMERGENCY" | "UNPAID";
    isPaidLeave: boolean;
  } | null;
  scheduledStartMinutes: number | null;
  scheduledEndMinutes: number | null;
};

type TeamScheduleRow = {
  employee: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    departmentName: string | null;
    positionName: string | null;
  };
  cells: TeamScheduleCell[];
};

type TeamScheduleResult = {
  success: boolean;
  error?: string;
  weekStart?: string;
  weekEnd?: string;
  days?: { date: string; label: string }[];
  rows?: TeamScheduleRow[];
};

const getNowInTz = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));

const toIsoDate = (date: Date) => {
  const safeDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0),
  );
  return safeDate.toLocaleDateString("en-CA", { timeZone: TZ });
};

const getWeekAnchor = (date: Date) =>
  startOfWeek(date, { weekStartsOn: 1 });

const formatMinutes = (minutes: number | null | undefined) => {
  if (minutes == null) return "";
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
};

const formatWeekRange = (weekStart?: string, weekEnd?: string) => {
  if (!weekStart || !weekEnd) return "";
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${weekEnd}T12:00:00`);
  return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
};

const leaveLabelMap: Record<
  NonNullable<TeamScheduleCell["leave"]>["leaveType"],
  string
> = {
  VACATION: "Vacation",
  SICK: "Sick",
  PERSONAL: "Personal",
  EMERGENCY: "Emergency",
  UNPAID: "Unpaid",
};

function ShiftCell({ cell }: { cell: TeamScheduleCell }) {
  const shift = cell.shift;
  const timeRange =
    cell.scheduledStartMinutes != null && cell.scheduledEndMinutes != null
      ? `${formatMinutes(cell.scheduledStartMinutes)} - ${formatMinutes(
          cell.scheduledEndMinutes,
        )}`
      : "";

  if (cell.leave) {
    return (
      <div className="flex min-h-20 flex-col justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
        <div className="space-y-1">
          <p className="text-xs font-semibold">
            {leaveLabelMap[cell.leave.leaveType]} leave
          </p>
          <p className="text-xs">
            {cell.leave.isPaidLeave ? "Paid leave" : "Unpaid leave"}
          </p>
        </div>
        {shift ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-200">
            Base: {shift.code} {timeRange}
          </p>
        ) : null}
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="flex min-h-20 items-center rounded-md border border-dashed border-border/70 bg-muted/20 p-2.5 text-xs text-muted-foreground">
        No schedule
      </div>
    );
  }

  if (shift.isDayOff) {
    return (
      <div className="flex min-h-20 flex-col justify-between rounded-md border border-slate-200 bg-slate-50 p-2.5 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200">
        <p className="text-xs font-semibold">Rest day</p>
        <p className="text-xs">{shift.name}</p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-20 flex-col justify-between gap-2 rounded-md border p-2.5"
      style={
        shift.colorHex
          ? {
              borderColor: shift.colorHex,
              backgroundColor: `${shift.colorHex}14`,
            }
          : undefined
      }
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-md">
            {shift.code}
          </Badge>
          {cell.source === "override" ? (
            <Badge className="rounded-md bg-violet-600 text-white">
              Override
            </Badge>
          ) : null}
        </div>
        <p className="text-xs font-semibold">{shift.name}</p>
      </div>
      <p className="text-xs text-muted-foreground">{timeRange}</p>
    </div>
  );
}

export function SupervisorTeamSchedule() {
  const [weekAnchor, setWeekAnchor] = useState(() => getWeekAnchor(getNowInTz()));
  const [data, setData] = useState<TeamScheduleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anchorDate = useMemo(() => toIsoDate(weekAnchor), [weekAnchor]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = (await getSupervisorTeamWeekSchedule({
          anchorDate,
        })) as TeamScheduleResult;
        if (!result.success) {
          throw new Error(result.error || "Failed to load team schedule");
        }
        if (mounted) setData(result);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load team schedule",
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [anchorDate]);

  const days = data?.days ?? [];
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Team Schedule</h1>
          <p className="text-sm text-muted-foreground">
            View assigned employees and their weekly shift coverage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekAnchor((current) => addWeeks(current, -1))}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekAnchor(getWeekAnchor(getNowInTz()))}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Current week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekAnchor((current) => addWeeks(current, 1))}
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b px-5 py-4">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5" />
              {formatWeekRange(data?.weekStart, data?.weekEnd) || "Week view"}
              {loading ? (
                <span className="ml-1 inline-flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1 text-xs font-normal text-muted-foreground">
                  <Spinner className="h-3.5 w-3.5" />
                  Refreshing
                </span>
              ) : null}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Read-only direct report schedule.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {!error && !loading && rows.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No employees assigned to you.
            </div>
          ) : null}

          {!error && rows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[1040px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-56">Employee</TableHead>
                    {days.map((day) => (
                      <TableHead key={day.date} className="w-32 px-2">
                        <div className="space-y-0.5">
                          <p className="font-semibold">{day.label}</p>
                          <p className="text-xs font-normal text-muted-foreground">
                            {day.date}
                          </p>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.employee.employeeId}>
                      <TableCell className="align-top">
                        <div className="space-y-0.5">
                          <p className="font-medium">
                            {row.employee.lastName}, {row.employee.firstName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.employee.employeeCode}
                          </p>
                          <p
                            className={cn(
                              "text-xs text-muted-foreground",
                              !row.employee.departmentName &&
                                !row.employee.positionName &&
                                "sr-only",
                            )}
                          >
                            {[row.employee.departmentName, row.employee.positionName]
                              .filter(Boolean)
                              .join(" - ")}
                          </p>
                        </div>
                      </TableCell>
                      {days.map((day) => {
                        const cell = row.cells.find(
                          (scheduleCell) => scheduleCell.date === day.date,
                        );
                        return (
                          <TableCell
                            key={`${row.employee.employeeId}:${day.date}`}
                            className="px-2 py-2 align-top"
                          >
                            {cell ? <ShiftCell cell={cell} /> : null}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
