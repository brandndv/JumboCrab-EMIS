"use client";

import { useMemo, useState } from "react";
import { useAttendance } from "@/components/dasboard/manage-attendance/attendance-provider";
import type { PunchRow } from "@/hooks/use-attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCcw, RotateCcw, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { TZ } from "@/lib/timezone";
import { updatePunch } from "@/actions/attendance/attendance-action";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const formatPunchLabel = (type: string) => {
  switch (type) {
    case "TIME_IN":
      return "TIME IN";
    case "TIME_OUT":
      return "TIME OUT";
    case "BREAK_IN":
      return "BREAK START";
    case "BREAK_OUT":
      return "BREAK END";
    default:
      return type.replace("_", " ").toUpperCase();
  }
};

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  });
};

const formatMinutesToTime = (minutes: number | null | undefined, asClock = true) => {
  if (minutes == null) return "—";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (asClock) return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  const parts = [];
  if (hrs) parts.push(`${hrs} hr${hrs === 1 ? "" : "s"}`);
  if (mins || !hrs) parts.push(`${mins} min${mins === 1 ? "" : "s"}`);
  return parts.join(" ");
};

const formatMinutesToClock12 = (minutes: number) => {
  const totalHours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hrs12 = ((totalHours + 11) % 12) + 1;
  const ampm = totalHours >= 12 ? "PM" : "AM";
  return `${hrs12.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")} ${ampm}`;
};

export function DailyAttendance() {
  const {
    rows,
    loading,
    error,
    punchError,
    date,
    punches,
    lockLoading,
    lockMessage,
    setDate,
    setPunchError,
    load,
    lockDay,
  } = useAttendance();
  const [filter, setFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [punchSearch, setPunchSearch] = useState("");
  const [punchTypeFilter, setPunchTypeFilter] = useState("");
  const [punchEdit, setPunchEdit] = useState<PunchRow | null>(null);
  const [punchEditType, setPunchEditType] = useState("");
  const [punchEditTime, setPunchEditTime] = useState("");
  const [punchSaving, setPunchSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return rows.filter((row) => {
      const empName = `${row.employee?.firstName || ""} ${row.employee?.lastName || ""}`
        .trim()
        .toLowerCase();
      const empCode = row.employee?.employeeCode?.toLowerCase() || "";
      const dept = row.employee?.department?.name?.toLowerCase() || "";
      const pos = row.employee?.position?.name?.toLowerCase() || "";
      const deptMatch = deptFilter ? row.employee?.department?.name === deptFilter : true;
      if (!deptMatch) return false;
      if (!term) return true;
      return (
        empName.includes(term) ||
        empCode.includes(term) ||
        dept.includes(term) ||
        pos.includes(term) ||
        row.status.toLowerCase().includes(term)
      );
    });
  }, [rows, filter, deptFilter]);

  const deptOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.employee?.department?.name) set.add(r.employee.department.name);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filteredPunches = useMemo(() => {
    const term = punchSearch.trim().toLowerCase();
    return punches
      .filter((p) => {
        const name = `${p.employee?.firstName || ""} ${p.employee?.lastName || ""}`.toLowerCase();
        const code = p.employee?.employeeCode?.toLowerCase() || "";
        const type = p.punchType.toLowerCase();
        const matchesType = punchTypeFilter ? type === punchTypeFilter.toLowerCase() : true;
        const matchesTerm = term ? name.includes(term) || code.includes(term) : true;
        return matchesType && matchesTerm;
      })
      .slice()
      .sort((a, b) => new Date(b.punchTime).getTime() - new Date(a.punchTime).getTime());
  }, [punches, punchSearch, punchTypeFilter]);

  const openPunchEdit = (p: PunchRow) => {
    setPunchEdit(p);
    setPunchEditType(p.punchType);
    const d = new Date(p.punchTime);
    const inputVal = Number.isNaN(d.getTime())
      ? ""
      : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setPunchEditTime(inputVal);
  };

  const savePunchEdit = async () => {
    if (!punchEdit) return;
    try {
      setPunchSaving(true);
      const result = await updatePunch({
        id: punchEdit.id,
        punchTime: punchEditTime
          ? new Date(punchEditTime).toISOString()
          : punchEdit.punchTime,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to update punch");
      }
      await load();
      setPunchEdit(null);
    } catch (err) {
      setPunchError(err instanceof Error ? err.message : "Failed to update punch");
    } finally {
      setPunchSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Daily Attendance</CardTitle>
          <p className="text-sm text-muted-foreground">
            View attendance for a single day.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
          <Button onClick={load} size="sm" className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Load
          </Button>
          <Button onClick={lockDay} size="sm" variant="outline" className="gap-2" disabled={lockLoading}>
            {lockLoading ? "Locking..." : "Lock day"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {lockMessage && (
          <p className="text-sm text-muted-foreground">{lockMessage}</p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Search by name, code, department"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full sm:w-72"
          />
          <div className="flex items-center gap-2">
            <select
              className="w-48 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">All departments</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setDate(todayISO())}>
              <RotateCcw className="h-4 w-4" /> Today
            </Button>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading attendance...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance records.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                    <TableHead>Time in</TableHead>
                    <TableHead>Punches</TableHead>
                    <TableHead>Breaks</TableHead>
                    <TableHead>Time out</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Over/Under</TableHead>
                    <TableHead>Expected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={`${row.employeeId}-${row.workDate}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {row.employee?.firstName} {row.employee?.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.employee?.employeeCode} · {row.employee?.department?.name || "—"} ·{" "}
                          {row.employee?.position?.name || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === "PRESENT" ? "secondary" : "outline"}
                        className={cn(
                          "uppercase tracking-wide",
                          row.status === "ABSENT" && "border-destructive text-destructive",
                          row.status === "LATE" && "border-amber-500 text-amber-600",
                          row.status === "INCOMPLETE" && "border-blue-500 text-blue-600"
                        )}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTime(row.actualInAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.punchesCount != null ? `${row.punchesCount} punch${row.punchesCount === 1 ? "" : "es"}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.breakMinutes != null
                        ? `${formatMinutesToTime(row.breakMinutes, false)}${row.breakCount ? ` (${row.breakCount}x)` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTime(row.actualOutAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.lateMinutes != null ? formatMinutesToTime(row.lateMinutes, false) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {!row.actualOutAt || row.scheduledEndMinutes == null
                        ? "—"
                        : row.overtimeMinutesRaw != null && row.overtimeMinutesRaw > 0
                          ? `${formatMinutesToTime(row.overtimeMinutesRaw, false)} OT`
                          : row.undertimeMinutes != null && row.undertimeMinutes > 0
                            ? `${formatMinutesToTime(row.undertimeMinutes, false)} UT`
                            : "On time"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.scheduledStartMinutes != null && row.scheduledEndMinutes != null ? (
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>

    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <CardTitle className="text-lg">Punches</CardTitle>
            <p className="text-sm text-muted-foreground">
              Recorded punches on {new Date(date).toLocaleDateString(undefined, { timeZone: TZ })}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Input
              placeholder="Search employee/code"
              value={punchSearch}
              onChange={(e) => setPunchSearch(e.target.value)}
              className="w-full sm:w-72"
            />
            <select
              className="w-48 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={punchTypeFilter}
              onChange={(e) => setPunchTypeFilter(e.target.value)}
            >
              <option value="">All types</option>
              {["TIME_IN", "TIME_OUT", "BREAK_IN", "BREAK_OUT"].map((t) => (
                <option key={t} value={t}>
                  {formatPunchLabel(t)}
                </option>
              ))}
            </select>
          </div>
          {punchError ? (
            <p className="text-sm text-destructive">{punchError}</p>
          ) : filteredPunches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No punches for this day.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPunches.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {p.employee?.firstName} {p.employee?.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.employee?.employeeCode} · {p.employee?.department?.name || "—"} ·{" "}
                          {p.employee?.position?.name || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm uppercase text-muted-foreground">
                      {formatPunchLabel(p.punchType)}
                    </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(p.punchTime)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => openPunchEdit(p)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
        )}
      </CardContent>
    </Card>

      <Dialog open={!!punchEdit} onOpenChange={(open) => !open && setPunchEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit punch</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {punchEdit?.employee?.firstName} {punchEdit?.employee?.lastName} ({punchEdit?.employee?.employeeCode})
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Input
                readOnly
                value={formatPunchLabel(punchEditType)}
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">Type is fixed; you can only edit the time.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Time</label>
              <Input
                type="datetime-local"
                value={punchEditTime}
                onChange={(e) => setPunchEditTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPunchEdit(null)}>
              Cancel
            </Button>
            <Button onClick={savePunchEdit} disabled={punchSaving || !punchEditType || !punchEditTime}>
              {punchSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
