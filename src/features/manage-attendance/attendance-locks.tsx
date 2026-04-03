"use client";

import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TZ } from "@/lib/timezone";
import {
  listAttendance,
  listAttendanceLockSummary,
  listLockableEmployees,
  setAttendanceLockState,
} from "@/actions/attendance/attendance-action";
import { Lock, RefreshCcw, Search, Unlock } from "lucide-react";
import { TableLoadingState } from "@/components/loading/loading-states";

type BimonthlyPeriod = "first" | "second";

type BimonthlyOption = {
  value: BimonthlyPeriod;
  label: string;
  start: string;
  end: string;
};

type LockSummaryRow = {
  date: string;
  totalRows: number;
  lockedRows: number;
  unlockedRows: number;
  lockState: "LOCKED" | "UNLOCKED" | "PARTIAL" | "NO_ROWS";
};

type LockableEmployee = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
};

type EmployeeLockRow = {
  id: string;
  workDate: string;
  status: string;
  actualInAt?: string | null;
  actualOutAt?: string | null;
  isLocked?: boolean;
};

const toTzIsoDate = (date: Date) =>
  date.toLocaleDateString("en-CA", { timeZone: TZ });

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

const formatDate = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    weekday: "short",
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

const lockStateLabel = (state: LockSummaryRow["lockState"]) => {
  if (state === "NO_ROWS") return "No rows";
  if (state === "LOCKED") return "Locked";
  if (state === "PARTIAL") return "Partial";
  return "Unlocked";
};

export function AttendanceLocks() {
  const { options: periodOptions, defaultPeriod } = useMemo(
    () => buildCurrentMonthBimonthlyOptions(),
    [],
  );

  const [period, setPeriod] = useState<BimonthlyPeriod>(defaultPeriod);
  const [summaryRows, setSummaryRows] = useState<LockSummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employees, setEmployees] = useState<LockableEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedEmployeeSnapshot, setSelectedEmployeeSnapshot] =
    useState<LockableEmployee | null>(null);
  const [employeeRows, setEmployeeRows] = useState<EmployeeLockRow[]>([]);
  const [employeeRowsLoading, setEmployeeRowsLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedRange =
    periodOptions.find((opt) => opt.value === period) ?? periodOptions[0];

  const loadSummary = async () => {
    if (!selectedRange) return;
    try {
      setSummaryLoading(true);
      setError(null);
      const result = await listAttendanceLockSummary({
        start: selectedRange.start,
        end: selectedRange.end,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to load lock summary");
      }
      setSummaryRows((result.data ?? []) as LockSummaryRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lock summary");
      setSummaryRows([]);
    } finally {
      setSummaryLoading(false);
    }
  };

  const searchEmployees = async (queryOverride?: string) => {
    try {
      setEmployeesLoading(true);
      setError(null);
      const query =
        typeof queryOverride === "string" ? queryOverride : employeeSearch;
      const result = await listLockableEmployees({ query, limit: 50 });
      if (!result.success) {
        throw new Error(result.error || "Failed to load employees");
      }
      const nextEmployees = (result.data ?? []) as LockableEmployee[];
      setEmployees(nextEmployees);
      if (selectedEmployeeId) {
        const refreshedSelected = nextEmployees.find(
          (employee) => employee.employeeId === selectedEmployeeId,
        );
        if (refreshedSelected) {
          setSelectedEmployeeSnapshot(refreshedSelected);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees");
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  };

  const loadEmployeeRows = async () => {
    if (!selectedRange || !selectedEmployeeId) {
      setEmployeeRows([]);
      return;
    }
    try {
      setEmployeeRowsLoading(true);
      setError(null);
      const result = await listAttendance({
        start: selectedRange.start,
        end: selectedRange.end,
        employeeId: selectedEmployeeId,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to load employee attendance");
      }
      setEmployeeRows((result.data ?? []) as EmployeeLockRow[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load employee attendance",
      );
      setEmployeeRows([]);
    } finally {
      setEmployeeRowsLoading(false);
    }
  };

  useEffect(() => {
    setPeriod(defaultPeriod);
  }, [defaultPeriod]);

  useEffect(() => {
    void searchEmployees("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    void loadEmployeeRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId, period]);

  const runLockAction = async (
    payload: {
      start: string;
      end?: string;
      lock: boolean;
      employeeId?: string;
    },
    successPrefix: string,
  ) => {
    try {
      setActionLoading(true);
      setError(null);
      setMessage(null);
      const result = await setAttendanceLockState(payload);
      if (!result.success) {
        throw new Error(result.error || "Failed to update lock state");
      }
      const updated = result.data?.updatedCount ?? 0;
      const blocked = result.data?.blockedPayrollLinkedRows ?? 0;
      setMessage(
        blocked > 0
          ? `${successPrefix} (${updated} row(s) affected, ${blocked} payroll-linked row(s) skipped)`
          : `${successPrefix} (${updated} row(s) affected)`,
      );
      await loadSummary();
      await loadEmployeeRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update lock state");
    } finally {
      setActionLoading(false);
    }
  };

  const employeeOptions = useMemo(() => {
    if (!selectedEmployeeSnapshot) return employees;
    const hasSelected = employees.some(
      (employee) => employee.employeeId === selectedEmployeeSnapshot.employeeId,
    );
    if (hasSelected) return employees;
    // Keep the selected option visible even when current search filter excludes it.
    return [selectedEmployeeSnapshot, ...employees];
  }, [employees, selectedEmployeeSnapshot]);

  const selectedEmployee =
    employeeOptions.find((employee) => employee.employeeId === selectedEmployeeId) ??
    null;

  const onEmployeeSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void searchEmployees(employeeSearch);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Bimonthly Locks</CardTitle>
            <p className="text-sm text-muted-foreground">
              Lock/unlock attendance rows per day or in one bimonthly action.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as BimonthlyPeriod)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-80"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void loadSummary()}
              disabled={summaryLoading || actionLoading}
              aria-label="Refresh lock summary"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="default"
              className="gap-2"
              disabled={actionLoading || summaryLoading || !selectedRange}
              onClick={() =>
                selectedRange &&
                void runLockAction(
                  {
                    start: selectedRange.start,
                    end: selectedRange.end,
                    lock: true,
                  },
                  "Bimonthly lock applied",
                )
              }
            >
              <Lock className="h-4 w-4" /> Lock Bimonthly
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={actionLoading || summaryLoading || !selectedRange}
              onClick={() =>
                selectedRange &&
                void runLockAction(
                  {
                    start: selectedRange.start,
                    end: selectedRange.end,
                    lock: false,
                  },
                  "Bimonthly unlock applied",
                )
              }
            >
              <Unlock className="h-4 w-4" /> Unlock Bimonthly
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Total Rows</TableHead>
                  <TableHead>Locked</TableHead>
                  <TableHead>Unlocked</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-3">
                      <TableLoadingState
                        label="Loading lock summary"
                        columns={6}
                        rows={3}
                      />
                    </TableCell>
                  </TableRow>
                ) : summaryRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      No dates found in selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  summaryRows.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell>{row.totalRows}</TableCell>
                      <TableCell>{row.lockedRows}</TableCell>
                      <TableCell>{row.unlockedRows}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.lockState === "LOCKED"
                              ? "success"
                              : row.lockState === "PARTIAL"
                                ? "warning"
                                : row.lockState === "UNLOCKED"
                                  ? "outline"
                                  : "secondary"
                          }
                          className="uppercase tracking-wide"
                        >
                          {lockStateLabel(row.lockState)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={actionLoading}
                            onClick={() =>
                              void runLockAction(
                                { start: row.date, lock: true },
                                `Locked ${row.date}`,
                              )
                            }
                          >
                            <Lock className="h-3.5 w-3.5" /> Lock
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={actionLoading}
                            onClick={() =>
                              void runLockAction(
                                { start: row.date, lock: false },
                                `Unlocked ${row.date}`,
                              )
                            }
                          >
                            <Unlock className="h-3.5 w-3.5" /> Unlock
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Employee Exception Lock</CardTitle>
          <p className="text-sm text-muted-foreground">
            Search an employee, then lock/unlock their rows for the selected bimonthly period.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <Input
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              onKeyDown={onEmployeeSearchKeyDown}
              placeholder="Search employee code or name"
            />
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => void searchEmployees(employeeSearch)}
              disabled={employeesLoading}
            >
              <Search className="h-4 w-4" /> Search
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEmployeeSearch("");
                void searchEmployees("");
              }}
              disabled={employeesLoading}
            >
              Clear
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <select
              value={selectedEmployeeId}
              onChange={(e) => {
                const nextEmployeeId = e.target.value;
                setSelectedEmployeeId(nextEmployeeId);
                if (!nextEmployeeId) {
                  setSelectedEmployeeSnapshot(null);
                  return;
                }
                const nextSelected =
                  employeeOptions.find(
                    (employee) => employee.employeeId === nextEmployeeId,
                  ) ?? null;
                setSelectedEmployeeSnapshot(nextSelected);
              }}
              disabled={employeesLoading && employeeOptions.length === 0}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select employee</option>
              {employeeOptions.map((employee) => (
                <option key={employee.employeeId} value={employee.employeeId}>
                  {employee.employeeCode} - {employee.firstName} {employee.lastName}
                </option>
              ))}
            </select>
            <Button
              className="gap-2"
              disabled={actionLoading || !selectedEmployeeId}
              onClick={() =>
                selectedEmployeeId &&
                selectedRange &&
                void runLockAction(
                  {
                    start: selectedRange.start,
                    end: selectedRange.end,
                    lock: true,
                    employeeId: selectedEmployeeId,
                  },
                  "Employee range locked",
                )
              }
            >
              <Lock className="h-4 w-4" /> Lock Employee Range
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={actionLoading || !selectedEmployeeId}
              onClick={() =>
                selectedEmployeeId &&
                selectedRange &&
                void runLockAction(
                  {
                    start: selectedRange.start,
                    end: selectedRange.end,
                    lock: false,
                    employeeId: selectedEmployeeId,
                  },
                  "Employee range unlocked",
                )
              }
            >
              <Unlock className="h-4 w-4" /> Unlock Employee Range
            </Button>
          </div>

          {!employeesLoading && employeeOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No employees matched your search.
            </p>
          ) : null}

          {selectedEmployee ? (
            <p className="text-sm text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{selectedEmployee.employeeCode}</span>{" "}
              {selectedEmployee.firstName} {selectedEmployee.lastName}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Lock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeRowsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-3">
                      <TableLoadingState
                        label="Loading employee rows"
                        columns={6}
                        rows={3}
                      />
                    </TableCell>
                  </TableRow>
                ) : !selectedEmployeeId ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      Select an employee to manage lock exceptions.
                    </TableCell>
                  </TableRow>
                ) : employeeRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      No attendance rows found for selected employee and period.
                    </TableCell>
                  </TableRow>
                ) : (
                  employeeRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.workDate)}</TableCell>
                      <TableCell>
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
                          className="uppercase tracking-wide"
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatTime(row.actualInAt)}</TableCell>
                      <TableCell>{formatTime(row.actualOutAt)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={row.isLocked ? "success" : "outline"}
                          className="uppercase tracking-wide"
                        >
                          {row.isLocked ? "Locked" : "Unlocked"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.isLocked ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={actionLoading}
                            onClick={() =>
                              void runLockAction(
                                {
                                  start: toTzIsoDate(new Date(row.workDate)),
                                  lock: false,
                                  employeeId: selectedEmployeeId,
                                },
                                `Unlocked ${formatDate(row.workDate)}`,
                              )
                            }
                          >
                            <Unlock className="h-3.5 w-3.5" /> Unlock
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={actionLoading}
                            onClick={() =>
                              void runLockAction(
                                {
                                  start: toTzIsoDate(new Date(row.workDate)),
                                  lock: true,
                                  employeeId: selectedEmployeeId,
                                },
                                `Locked ${formatDate(row.workDate)}`,
                              )
                            }
                          >
                            <Lock className="h-3.5 w-3.5" /> Lock
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
