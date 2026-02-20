import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { TZ } from "@/lib/timezone";
import { assignPatternToEmployee } from "@/actions/schedule/schedule-action";
import {
  EmployeeLite,
  Pattern,
  PatternAssignment,
  ShiftLite,
  formatMinutes,
  formatDateDisplay,
  makeDate,
  patternLabel,
} from "../../../types/schedule-types";

export type PatternEditState = {
  code: string;
  name: string;
  dayShifts: Record<string, string>;
};

type PatternsSectionProps = {
  showAssignPattern: boolean;
  showCreatePattern: boolean;
  showWeeklyPatterns: boolean;
  employees: EmployeeLite[];
  patterns: Pattern[];
  shifts: ShiftLite[];
  assignments: PatternAssignment[];
  assignEmployeeId: string;
  assignPatternId: string;
  assignEffective: string;
  assignError: string | null;
  assignSaving: boolean;
  assignSuccess: string | null;
  onRefresh: () => void;
  onAssignEmployeeChange: (value: string) => void;
  onAssignPatternChange: (value: string) => void;
  onAssignEffectiveChange: (value: string) => void;
  onAssignSubmit: () => void;
  onReassign: (assignment: PatternAssignment) => void;
  onDeleteAssignment: (id: string) => void;
  editingPatternId: string | null;
  patternCode: string;
  patternName: string;
  dayShifts: Record<string, string>;
  patternSaving: boolean;
  patternError: string | null;
  onPatternCodeChange: (value: string) => void;
  onPatternNameChange: (value: string) => void;
  onDayShiftChange: (key: string, value: string) => void;
  onCreatePattern: () => void;
  onDeletePattern: (id: string) => void;
  onStartEditPattern: (pattern: Pattern) => void;
  patternEditOpen: boolean;
  onPatternEditOpenChange: (open: boolean) => void;
  patternEdit: PatternEditState | null;
  patternEditError: string | null;
  patternEditSaving: boolean;
  onPatternEditChange: (value: PatternEditState) => void;
  onSavePatternEdit: () => void;
  onCancelPatternEdit: () => void;
};

export function PatternsSection({
  showAssignPattern,
  showCreatePattern,
  showWeeklyPatterns,
  employees,
  patterns,
  shifts,
  assignments,
  assignEmployeeId,
  assignPatternId,
  assignEffective,
  assignError,
  assignSaving,
  assignSuccess,
  onRefresh,
  onAssignEmployeeChange,
  onAssignPatternChange,
  onAssignEffectiveChange,
  onAssignSubmit,
  onReassign,
  onDeleteAssignment,
  editingPatternId,
  patternCode,
  patternName,
  dayShifts,
  patternSaving,
  patternError,
  onPatternCodeChange,
  onPatternNameChange,
  onDayShiftChange,
  onCreatePattern,
  onDeletePattern,
  onStartEditPattern,
  patternEditOpen,
  onPatternEditOpenChange,
  patternEdit,
  patternEditError,
  patternEditSaving,
  onPatternEditChange,
  onSavePatternEdit,
  onCancelPatternEdit,
}: PatternsSectionProps) {
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [patternSearch, setPatternSearch] = useState("");
  const shiftLabel = useMemo(
    () => (shiftId: number | null) => {
      if (!shiftId) return "Rest day";
      const s = shifts.find((sh) => sh.id === shiftId);
      return s ? s.name : "Rest day";
    },
    [shifts]
  );
  const filteredEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((emp) =>
      `${emp.firstName} ${emp.lastName} ${emp.employeeCode}`
        .toLowerCase()
        .includes(term)
    );
  }, [employees, employeeSearch]);

  const filteredPatterns = useMemo(() => {
    const term = patternSearch.trim().toLowerCase();
    if (!term) return patterns;
    return patterns.filter((p) =>
      `${p.name} ${p.code}`.toLowerCase().includes(term)
    );
  }, [patterns, patternSearch]);

  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentPatternFilter, setAssignmentPatternFilter] = useState("");
  const filteredAssignments = useMemo(() => {
    const term = assignmentSearch.trim().toLowerCase();
    return assignments.filter((a) => {
      const matchesPattern =
        !assignmentPatternFilter || a.pattern?.id === assignmentPatternFilter;
      const matchesTerm = term
        ? `${a.employee.firstName} ${a.employee.lastName} ${a.employee.employeeCode}`
            .toLowerCase()
            .includes(term)
        : true;
      return matchesPattern && matchesTerm;
    });
  }, [assignments, assignmentPatternFilter, assignmentSearch]);

  const [expandedEmployees, setExpandedEmployees] = useState<
    Record<string, boolean>
  >({});
  const [assignmentEdit, setAssignmentEdit] =
    useState<PatternAssignment | null>(null);
  const [assignmentEditPattern, setAssignmentEditPattern] = useState("");
  const [assignmentEditDate, setAssignmentEditDate] = useState("");
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  const groupedAssignments = useMemo(() => {
    const grouped: Record<
      string,
      { employee: EmployeeLite; entries: PatternAssignment[] }
    > = {};
    for (const a of filteredAssignments) {
      if (!grouped[a.employeeId]) {
        grouped[a.employeeId] = { employee: a.employee, entries: [] };
      }
      grouped[a.employeeId].entries.push(a);
    }
    return Object.values(grouped).map((g) => {
      const [latest, ...older] = g.entries;
      return { employee: g.employee, latest, older };
    });
  }, [filteredAssignments]);

  const openEditAssignment = (assignment: PatternAssignment) => {
    setAssignmentEdit(assignment);
    setAssignmentEditPattern(assignment.pattern?.id ?? "");
    const parsed = new Date(assignment.effectiveDate);
    const dateInput = Number.isNaN(parsed.getTime())
      ? assignment.effectiveDate.slice(0, 10)
      : parsed.toLocaleDateString("en-CA", { timeZone: TZ });
    setAssignmentEditDate(dateInput);
  };

  const saveAssignmentEdit = async () => {
    if (!assignmentEdit || !assignmentEditPattern || !assignmentEditDate)
      return;
    try {
      setAssignmentSaving(true);
      const result = await assignPatternToEmployee({
        employeeId: assignmentEdit.employeeId,
        patternId: assignmentEditPattern,
        effectiveDate: assignmentEditDate,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to assign pattern");
      }
      await onRefresh();
      setAssignmentEdit(null);
    } catch (error) {
      console.error("Failed to update assignment", error);
    } finally {
      setAssignmentSaving(false);
    }
  };

  return (
    <>
      {showAssignPattern && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Assign Weekly Pattern</CardTitle>
            <p className="text-sm text-muted-foreground">
              Set a weekly shift pattern effective from a start date.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Employee</label>
                <div className="relative">
                  <Input
                    placeholder="Select employee"
                    value={
                      assignEmployeeId
                        ? filteredEmployees.find(
                            (e) => e.employeeId === assignEmployeeId
                          )?.firstName +
                          " " +
                          filteredEmployees.find(
                            (e) => e.employeeId === assignEmployeeId
                          )?.lastName
                        : ""
                    }
                    onFocus={() =>
                      setExpandedEmployees((prev) => ({
                        ...prev,
                        __empPicker: true,
                      }))
                    }
                    readOnly
                  />
                  {(expandedEmployees as any).__empPicker && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border bg-card shadow-lg p-3 space-y-2">
                      <Input
                        autoFocus
                        placeholder="Search employee"
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                      />
                      <div className="max-h-56 overflow-y-auto divide-y">
                        {filteredEmployees.map((emp) => (
                          <button
                            type="button"
                            key={emp.employeeId}
                            onClick={() => {
                              onAssignEmployeeChange(emp.employeeId);
                              setExpandedEmployees((prev) => ({
                                ...prev,
                                __empPicker: false,
                              }));
                            }}
                            className="w-full text-left px-2 py-2 hover:bg-muted/60"
                          >
                            <div className="font-medium">
                              {emp.firstName} {emp.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {emp.employeeCode} · {emp.department?.name || "—"}
                            </div>
                          </button>
                        ))}
                        {filteredEmployees.length === 0 && (
                          <div className="px-2 py-2 text-sm text-muted-foreground">
                            No matches
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setExpandedEmployees((prev) => ({
                              ...prev,
                              __empPicker: false,
                            }))
                          }
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pattern</label>
                <div className="relative">
                  <Input
                    placeholder="Select pattern"
                    value={
                      assignPatternId
                        ? filteredPatterns.find((p) => p.id === assignPatternId)
                            ?.name || ""
                        : ""
                    }
                    onFocus={() =>
                      setExpandedEmployees((prev) => ({
                        ...prev,
                        __patPicker: true,
                      }))
                    }
                    readOnly
                  />
                  {(expandedEmployees as any).__patPicker && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border bg-card shadow-lg p-3 space-y-2">
                      <Input
                        autoFocus
                        placeholder="Search pattern"
                        value={patternSearch}
                        onChange={(e) => setPatternSearch(e.target.value)}
                      />
                      <div className="max-h-56 overflow-y-auto divide-y">
                        {filteredPatterns.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => {
                              onAssignPatternChange(p.id);
                              setExpandedEmployees((prev) => ({
                                ...prev,
                                __patPicker: false,
                              }));
                            }}
                            className="w-full text-left px-2 py-2 hover:bg-muted/60"
                          >
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.code}
                            </div>
                          </button>
                        ))}
                        {filteredPatterns.length === 0 && (
                          <div className="px-2 py-2 text-sm text-muted-foreground">
                            No matches
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setExpandedEmployees((prev) => ({
                              ...prev,
                              __patPicker: false,
                            }))
                          }
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Effective date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <span>
                        {makeDate(assignEffective)
                          ? makeDate(assignEffective)?.toLocaleDateString(
                              "en-US",
                              { timeZone: TZ }
                            )
                          : "Select date"}
                      </span>
                      <CalendarClock className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={makeDate(assignEffective)}
                      onSelect={(value) => {
                        if (!value) {
                          onAssignEffectiveChange("");
                          return;
                        }
                        onAssignEffectiveChange(
                          value.toLocaleDateString("en-CA", { timeZone: TZ })
                        );
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {assignError && (
              <p className="text-sm text-destructive">{assignError}</p>
            )}
            {assignSuccess && (
              <p className="text-sm text-primary">{assignSuccess}</p>
            )}
            <div className="flex justify-end">
              <Button onClick={onAssignSubmit} disabled={assignSaving}>
                {assignSaving ? "Saving..." : "Assign pattern"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">
              Current Pattern Assignments
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Latest weekly pattern per employee.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              className="w-full sm:w-56 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Search employee"
              value={assignmentSearch}
              onChange={(e) => setAssignmentSearch(e.target.value)}
            />
            <select
              className="w-full sm:w-48 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={assignmentPatternFilter}
              onChange={(e) => setAssignmentPatternFilter(e.target.value)}
            >
              <option value="">All patterns</option>
              {patterns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {groupedAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No assignments found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Employee</th>
                    <th className="px-3 py-2 text-left">Pattern</th>
                    <th className="px-3 py-2 text-left">Effective</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedAssignments.map(({ employee, latest, older }) => {
                    const expanded =
                      expandedEmployees[employee.employeeId] ?? false;
                    return (
                      <React.Fragment key={employee.employeeId}>
                        <tr
                          key={`${employee.employeeId}-${latest.effectiveDate}`}
                          className="border-t"
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-start gap-2">
                              {older.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedEmployees((prev) => ({
                                      ...prev,
                                      [employee.employeeId]: !expanded,
                                    }))
                                  }
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  {expanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {employee.firstName} {employee.lastName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {employee.employeeCode} ·{" "}
                                  {employee.department?.name || "—"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {latest.pattern ? latest.pattern.name : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {formatDateDisplay(latest.effectiveDate)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            <span className="rounded-full bg-primary/10 text-primary px-2 py-1 text-xs">
                              Latest
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1"
                              onClick={() => openEditAssignment(latest)}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-destructive"
                              onClick={() => onDeleteAssignment(latest.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </td>
                        </tr>
                        {expanded &&
                          older.map((a) => (
                            <tr
                              key={`${employee.employeeId}-${a.effectiveDate}`}
                              className="border-t bg-muted/30"
                            >
                              <td className="px-3 py-2 pl-10 text-sm text-muted-foreground">
                                Older assignment
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {a.pattern ? a.pattern.name : "—"}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {formatDateDisplay(a.effectiveDate)}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                <span className="rounded-full bg-muted px-2 py-1 text-xs">
                                  Older
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1"
                                  onClick={() => openEditAssignment(a)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1 text-destructive"
                                  onClick={() => onDeleteAssignment(a.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!assignmentEdit}
        onOpenChange={(open) => !open && setAssignmentEdit(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {assignmentEdit?.employee.firstName}{" "}
              {assignmentEdit?.employee.lastName} (
              {assignmentEdit?.employee.employeeCode})
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Pattern</label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={assignmentEditPattern}
                onChange={(e) => setAssignmentEditPattern(e.target.value)}
              >
                <option value="">Select pattern</option>
                {patterns.map((p) => (
                  <option key={p.id} value={p.id}>
                    {patternLabel(p)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Effective date</label>
              <Input
                type="date"
                value={assignmentEditDate}
                onChange={(e) => setAssignmentEditDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAssignmentEdit(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveAssignmentEdit}
              disabled={
                assignmentSaving ||
                !assignmentEditPattern ||
                !assignmentEditDate
              }
            >
              {assignmentSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showCreatePattern && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Create Weekly Pattern</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose a shift for each day to reuse in assignments.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <Input
                  value={patternCode}
                  onChange={(e) => onPatternCodeChange(e.target.value)}
                  placeholder="PAT-WEEKDAY"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={patternName}
                  onChange={(e) => onPatternNameChange(e.target.value)}
                  placeholder="Weekday Pattern"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {[
                { key: "monShiftId", label: "Monday" },
                { key: "tueShiftId", label: "Tuesday" },
                { key: "wedShiftId", label: "Wednesday" },
                { key: "thuShiftId", label: "Thursday" },
                { key: "friShiftId", label: "Friday" },
                { key: "satShiftId", label: "Saturday" },
                { key: "sunShiftId", label: "Sunday" },
              ].map((d) => (
                <div className="space-y-2" key={d.key}>
                  <label className="text-sm font-medium">{d.label}</label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={dayShifts[d.key]}
                    onChange={(e) => onDayShiftChange(d.key, e.target.value)}
                  >
                    <option value="">Rest day</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatMinutes(s.startMinutes)} -{" "}
                        {formatMinutes(s.endMinutes)})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {patternError && (
              <p className="text-sm text-destructive">{patternError}</p>
            )}
            <div className="flex justify-end">
              <Button
                onClick={onCreatePattern}
                disabled={patternSaving}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {patternSaving ? "Saving..." : "Create pattern"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showWeeklyPatterns && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Weekly Patterns</CardTitle>
              <p className="text-sm text-muted-foreground">
                View and edit weekly patterns.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" /> Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {patterns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No patterns yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[10%]">Code</TableHead>
                      <TableHead className="w-[14%]">Name</TableHead>
                      <TableHead className="w-[8%]">Mon</TableHead>
                      <TableHead className="w-[8%]">Tue</TableHead>
                      <TableHead className="w-[8%]">Wed</TableHead>
                      <TableHead className="w-[8%]">Thu</TableHead>
                      <TableHead className="w-[8%]">Fri</TableHead>
                      <TableHead className="w-[8%]">Sat</TableHead>
                      <TableHead className="w-[8%]">Sun</TableHead>
                      <TableHead className="w-[16%] text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patterns.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.code}</TableCell>
                        <TableCell className="text-sm">{p.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {shiftLabel(p.monShiftId)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {shiftLabel(p.tueShiftId)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {shiftLabel(p.wedShiftId)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {shiftLabel(p.thuShiftId)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {shiftLabel(p.friShiftId)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {shiftLabel(p.satShiftId)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {shiftLabel(p.sunShiftId)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-destructive"
                              onClick={() => onDeletePattern(p.id)}
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-2"
                              onClick={() => onStartEditPattern(p)}
                            >
                              <Pencil className="h-4 w-4" /> Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {patternEditError && (
              <p className="text-sm text-destructive">{patternEditError}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={patternEditOpen}
        onOpenChange={(open) => onPatternEditOpenChange(open)}
      >
        <DialogContent className="w-[95vw] max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit weekly pattern</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <Input
                  value={patternEdit?.code ?? ""}
                  onChange={(e) =>
                    patternEdit &&
                    onPatternEditChange({
                      ...patternEdit,
                      code: e.target.value,
                    })
                  }
                  placeholder="PAT-WEEKDAY"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={patternEdit?.name ?? ""}
                  onChange={(e) =>
                    patternEdit &&
                    onPatternEditChange({
                      ...patternEdit,
                      name: e.target.value,
                    })
                  }
                  placeholder="Weekday Pattern"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {patternEdit &&
                [
                  { key: "monShiftId", label: "Monday" },
                  { key: "tueShiftId", label: "Tuesday" },
                  { key: "wedShiftId", label: "Wednesday" },
                  { key: "thuShiftId", label: "Thursday" },
                  { key: "friShiftId", label: "Friday" },
                  { key: "satShiftId", label: "Saturday" },
                  { key: "sunShiftId", label: "Sunday" },
                ].map((d) => (
                  <div className="space-y-2" key={d.key}>
                    <label className="text-sm font-medium">{d.label}</label>
                    <select
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={patternEdit.dayShifts[d.key] ?? ""}
                      onChange={(e) =>
                        onPatternEditChange({
                          ...patternEdit,
                          dayShifts: {
                            ...patternEdit.dayShifts,
                            [d.key]: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="">Rest day</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({formatMinutes(s.startMinutes)} -{" "}
                          {formatMinutes(s.endMinutes)})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
            {patternEditError && (
              <p className="text-sm text-destructive">{patternEditError}</p>
            )}
          </div>
          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              className="gap-2 text-destructive"
              disabled={patternEditSaving || !patternEdit}
              onClick={() =>
                editingPatternId && onDeletePattern(editingPatternId)
              }
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2 sm:justify-end">
              <Button
                variant="ghost"
                onClick={onCancelPatternEdit}
                disabled={patternEditSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={onSavePatternEdit}
                disabled={patternEditSaving || !patternEdit}
              >
                {patternEditSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
