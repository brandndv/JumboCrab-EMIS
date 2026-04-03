"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listAttendance,
  listLockableEmployees,
} from "@/actions/attendance/attendance-action";
import {
  listDepartmentOptions,
  type DepartmentOption,
} from "@/actions/organization/departments-action";
import { listPositions } from "@/actions/organization/positions-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TZ } from "@/lib/timezone";
import { Clock4, RefreshCcw, RotateCcw, Search } from "lucide-react";

type AttendanceRow = {
  id: string;
  workDate: string;
  status: string;
  expectedShiftId?: number | null;
  expectedShiftName?: string | null;
  scheduledStartMinutes?: number | null;
  scheduledEndMinutes?: number | null;
  scheduledBreakMinutes?: number | null;
  actualInAt?: string | null;
  actualOutAt?: string | null;
  forgotToTimeOut?: boolean;
  workedMinutes?: number | null;
  workedHoursAndMinutes?: string | null;
  dailyRate?: number | null;
  ratePerMinute?: number | null;
  payableAmount?: number | null;
  deductedBreakMinutes?: number | null;
  netWorkedMinutes?: number | null;
  netWorkedHoursAndMinutes?: string | null;
  payableWorkedMinutes?: number | null;
  payableWorkedHoursAndMinutes?: string | null;
  lateGraceCreditMinutes?: number | null;
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

type PositionOption = {
  positionId: string;
  name: string;
  departmentId: string;
};

type EmployeeOption = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
};

const pad = (num: number) => num.toString().padStart(2, "0");

const formatMinutesToTime = (
  minutes: number | null | undefined,
  asClock = true,
) => {
  if (minutes == null) return "—";
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
  const hrs12 = ((totalHours + 11) % 12) + 1;
  const ampm = totalHours >= 12 ? "PM" : "AM";
  return `${hrs12.toString().padStart(2, "0")}:${pad(mins)} ${ampm}`;
};

const toTzDate = (date: Date) =>
  new Date(date).toLocaleDateString("en-CA", { timeZone: TZ });

const todayISO = () => toTzDate(new Date());

const sevenDaysAgoISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return toTzDate(d);
};

const fifteenDaysAgoISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return toTzDate(d);
};

const monthRangeISO = (year: number, month: number) => {
  const start = new Date(year, month, 1, 12, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 12, 0, 0, 0);
  return {
    start: toTzDate(start),
    end: toTzDate(end),
  };
};

export function AttendanceHistoryTable() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeIdFilter, setEmployeeIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentIdFilter, setDepartmentIdFilter] = useState("");
  const [positionIdFilter, setPositionIdFilter] = useState("");
  const [startDate, setStartDate] = useState(sevenDaysAgoISO());
  const [endDate, setEndDate] = useState(todayISO());

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const filteredPositions = useMemo(() => {
    if (!departmentIdFilter) return positions;
    return positions.filter((position) => position.departmentId === departmentIdFilter);
  }, [positions, departmentIdFilter]);

  const filteredEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      `${employee.employeeCode} ${employee.firstName} ${employee.lastName}`
        .toLowerCase()
        .includes(term),
    );
  }, [employeeSearch, employees]);

  const selectedEmployeeLabel = useMemo(() => {
    if (!employeeIdFilter) return "All employees";
    const selected = employees.find((row) => row.employeeId === employeeIdFilter);
    if (!selected) return "Select an employee";
    return `${selected.employeeCode} - ${selected.firstName} ${selected.lastName}`;
  }, [employeeIdFilter, employees]);

  const loadFilterOptions = async () => {
    const [departmentResult, positionResult, employeeResult] = await Promise.all([
      listDepartmentOptions(),
      listPositions(),
      listLockableEmployees({ limit: 500 }),
    ]);

    if (departmentResult.success) {
      setDepartments(departmentResult.data ?? []);
    }
    if (positionResult.success) {
      setPositions(
        (positionResult.data ?? []).map((row) => ({
          positionId: row.positionId,
          name: row.name,
          departmentId: row.departmentId,
        })),
      );
    }
    if (employeeResult.success) {
      setEmployees(employeeResult.data ?? []);
    }
  };

  const load = async (options?: {
    page?: number;
    pageSize?: number;
    employeeId?: string;
    status?: string;
    departmentId?: string;
    positionId?: string;
    start?: string;
    end?: string;
  }) => {
    const targetPage = options?.page ?? page;
    const targetPageSize = options?.pageSize ?? pageSize;
    const targetEmployeeId = options?.employeeId ?? employeeIdFilter;
    const targetStatus = options?.status ?? statusFilter;
    const targetDepartmentId = options?.departmentId ?? departmentIdFilter;
    const targetPositionId = options?.positionId ?? positionIdFilter;
    const targetStartDate = options?.start ?? startDate;
    const targetEndDate = options?.end ?? endDate;

    try {
      setLoading(true);
      setError(null);
      const result = await listAttendance({
        start: targetStartDate,
        end: targetEndDate,
        employeeId: targetEmployeeId || undefined,
        status: targetStatus || undefined,
        departmentId: targetDepartmentId || undefined,
        positionId: targetPositionId || undefined,
        page: targetPage,
        pageSize: targetPageSize,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to load attendance");
      }

      setRows((result.data ?? []) as AttendanceRow[]);
      setTotalCount(result.totalCount ?? 0);
      setTotalPages(Math.max(1, result.totalPages ?? 1));
      setPage(result.page ?? targetPage);
      setPageSize(result.pageSize ?? targetPageSize);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load attendance",
      );
      setRows([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFilterOptions();
    void load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    void load({ page: 1 });
  };

  const resetRange = () => {
    setStartDate(sevenDaysAgoISO());
    setEndDate(todayISO());
  };

  const clearFilters = () => {
    setEmployeeSearch("");
    setEmployeeIdFilter("");
    setStatusFilter("");
    setDepartmentIdFilter("");
    setPositionIdFilter("");
    void load({
      page: 1,
      employeeId: "",
      status: "",
      departmentId: "",
      positionId: "",
    });
  };

  const applyPreset = (
    preset: "today" | "last7" | "last15" | "thisMonth" | "lastMonth",
  ) => {
    const now = new Date();
    if (preset === "today") {
      const today = todayISO();
      setStartDate(today);
      setEndDate(today);
      void load({ page: 1, start: today, end: today });
      return;
    }
    if (preset === "last7") {
      const start = sevenDaysAgoISO();
      const end = todayISO();
      setStartDate(start);
      setEndDate(end);
      void load({ page: 1, start, end });
      return;
    }
    if (preset === "last15") {
      const start = fifteenDaysAgoISO();
      const end = todayISO();
      setStartDate(start);
      setEndDate(end);
      void load({ page: 1, start, end });
      return;
    }
    if (preset === "thisMonth") {
      const range = monthRangeISO(now.getFullYear(), now.getMonth());
      setStartDate(range.start);
      setEndDate(range.end);
      void load({ page: 1, start: range.start, end: range.end });
      return;
    }
    const range = monthRangeISO(now.getFullYear(), now.getMonth() - 1);
    setStartDate(range.start);
    setEndDate(range.end);
    void load({ page: 1, start: range.start, end: range.end });
  };

  const totalFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const totalTo = Math.min(totalCount, page * pageSize);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Attendance</CardTitle>
        <p className="text-sm text-muted-foreground">
          Daily attendance with expected vs. actual times.
        </p>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        <div className="rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Select
                value={employeeIdFilter || "__all"}
                onValueChange={(value) =>
                  setEmployeeIdFilter(value === "__all" ? "" : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{selectedEmployeeLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <div className="px-2 py-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search employees..."
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <SelectItem value="__all">All employees</SelectItem>
                  {filteredEmployees.map((employee) => (
                    <SelectItem key={employee.employeeId} value={employee.employeeId}>
                      {employee.employeeCode} - {employee.firstName} {employee.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 lg:col-span-2"
              value={departmentIdFilter}
              onChange={(e) => {
                setDepartmentIdFilter(e.target.value);
                setPositionIdFilter("");
              }}
              aria-label="Filter by department"
              title="Filter by department"
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.departmentId} value={department.departmentId}>
                  {department.name}
                </option>
              ))}
            </select>

            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 lg:col-span-2"
              value={positionIdFilter}
              onChange={(e) => setPositionIdFilter(e.target.value)}
              aria-label="Filter by position"
              title="Filter by position"
            >
              <option value="">All positions</option>
              {filteredPositions.map((position) => (
                <option key={position.positionId} value={position.positionId}>
                  {position.name}
                </option>
              ))}
            </select>

            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 lg:col-span-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              title="Filter by status"
            >
              <option value="">All status</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LEAVE">Leave</option>
              <option value="LATE">Late</option>
              <option value="INCOMPLETE">Incomplete</option>
              <option value="REST">Rest</option>
            </select>

            <div className="flex gap-2 lg:col-span-1 lg:justify-end">
              <Button
                variant="outline"
                size="icon"
                onClick={() => void load()}
                aria-label="Reload"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={clearFilters} className="whitespace-nowrap">
                Clear
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => applyPreset("today")}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("last7")}>
                Last 7 days
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("last15")}>
                Last 15 days
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("thisMonth")}>
                This month
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("lastMonth")}>
                Last month
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
              <Button variant="ghost" size="sm" onClick={resetRange} className="gap-2">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
              <Button onClick={applyFilters} size="sm" className="gap-2">
                <Clock4 className="h-4 w-4" /> Apply
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading attendance...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance records.</p>
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
                  <TableHead>Worked / Payable</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Undertime</TableHead>
                  <TableHead>Overtime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const key = `${row.employeeId}-${row.workDate}`;
                  const inAt = row.actualInAt ? new Date(row.actualInAt) : null;
                  const outAt = row.actualOutAt ? new Date(row.actualOutAt) : null;
                  const runningMinutes =
                    inAt && !outAt
                      ? Math.max(
                          0,
                          Math.round((now.getTime() - inAt.getTime()) / 60000),
                        )
                      : null;
                  const workedLabel =
                    runningMinutes != null
                      ? `${formatMinutesToTime(runningMinutes, false)} (running)`
                      : row.netWorkedHoursAndMinutes
                        ? row.netWorkedHoursAndMinutes
                        : row.workedHoursAndMinutes
                          ? row.workedHoursAndMinutes
                          : row.netWorkedMinutes != null
                            ? formatMinutesToTime(row.netWorkedMinutes, false)
                            : row.workedMinutes != null
                              ? formatMinutesToTime(row.workedMinutes, false)
                              : "—";
                  const payableLabel = row.payableWorkedHoursAndMinutes
                    ? row.payableWorkedHoursAndMinutes
                    : row.payableWorkedMinutes != null
                      ? formatMinutesToTime(row.payableWorkedMinutes, false)
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
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={
                              row.status === "PRESENT"
                                ? "success"
                                : row.status === "LATE"
                                  ? "warning"
                                  : row.status === "LEAVE"
                                    ? "secondary"
                                    : row.status === "INCOMPLETE"
                                      ? "info"
                                      : row.status === "ABSENT"
                                      ? "destructive"
                                      : "outline"
                            }
                            className="w-fit uppercase tracking-wide"
                          >
                            {row.status}
                          </Badge>
                          {row.forgotToTimeOut ? (
                            <Badge className="w-fit uppercase tracking-wide" variant="destructive">
                              Forgot time out
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.scheduledStartMinutes != null &&
                        row.scheduledEndMinutes != null ? (
                          <div className="flex flex-col">
                            <span>
                              {formatMinutesToClock12(row.scheduledStartMinutes)} -{" "}
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
                        {formatDateTime(row.actualInAt)} - {formatDateTime(row.actualOutAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.breakMinutes != null
                          ? `${formatMinutesToTime(row.breakMinutes, false)}${row.breakCount ? ` (${row.breakCount}x)` : ""}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex flex-col leading-tight">
                          <span>{workedLabel}</span>
                          <span className="text-xs text-muted-foreground">
                            Payable: {payableLabel}
                            {(row.lateGraceCreditMinutes ?? 0) > 0
                              ? ` (incl. ${formatMinutesToTime(row.lateGraceCreditMinutes, false)} grace)`
                              : ""}
                          </span>
                        </div>
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

        <div className="flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {totalFrom}-{totalTo} of {totalCount}
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <select
              className="rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={pageSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                setPageSize(nextSize);
                void load({ page: 1, pageSize: nextSize });
              }}
            >
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={150}>150 / page</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void load({ page: page - 1 })}
              disabled={loading || page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} / {Math.max(1, totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load({ page: page + 1 })}
              disabled={loading || page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
