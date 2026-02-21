"use client";

import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { TZ } from "@/lib/timezone";
import {
  createPattern,
  deletePattern as deletePatternAction,
  deletePatternAssignment,
  listPatternAssignments,
  updatePattern,
} from "@/actions/schedule/patterns-action";
import {
  assignPatternToEmployee,
  deleteScheduleOverride,
  getScheduleSnapshot,
  listScheduleOverrides,
  upsertScheduleOverride,
} from "@/actions/schedule/schedule-action";
import {
  createShift,
  deleteShift,
  updateShift,
} from "@/actions/schedule/shifts-action";
import { DailyScheduleCard } from "./daily-schedule-card";
import { PatternEditState, PatternsSection } from "./patterns-section";
import { OverridesSection } from "./overrides-section";
import { ShiftEditState, ShiftsSection } from "./shifts-section";
import {
  EmployeeLite,
  minutesToTimeInput,
  normalizeOverride,
  normalizePattern,
  normalizeShift,
  OverrideRow,
  Pattern,
  PatternAssignment,
  ScheduleEntry,
  ShiftLite,
  todayISO,
  toDateInputValue,
  makeDate,
} from "../../../types/schedule-types";

type ScheduleBoardProps = {
  mode?: "full" | "overrides" | "patterns";
};

export function ScheduleBoard({ mode = "full" }: ScheduleBoardProps) {
  const [date, setDate] = useState(todayISO());
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternAssignments, setPatternAssignments] = useState<
    PatternAssignment[]
  >([]);
  const [shifts, setShifts] = useState<ShiftLite[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignPatternId, setAssignPatternId] = useState("");
  const [assignEffective, setAssignEffective] = useState(todayISO());
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  const [overrideEmployeeId, setOverrideEmployeeId] = useState("");
  const [overrideShiftId, setOverrideShiftId] = useState<string>("");
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const overrideSource = "MANUAL";
  const [overrideIsRange, setOverrideIsRange] = useState(false);
  const [overrideEndDate, setOverrideEndDate] = useState<string | null>(null);
  const [editingOverride, setEditingOverride] = useState<OverrideRow | null>(
    null
  );
  const [overrideEditOpen, setOverrideEditOpen] = useState(false);
  const [overridePickerOpen, setOverridePickerOpen] = useState(false);

  const [shiftCode, setShiftCode] = useState("");
  const [shiftName, setShiftName] = useState("");
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");
  const [shiftSpansMidnight, setShiftSpansMidnight] = useState(false);
  const [shiftBreakStart, setShiftBreakStart] = useState("");
  const [shiftBreakEnd, setShiftBreakEnd] = useState("");
  const [shiftNotes, setShiftNotes] = useState("");
  const [shiftSaving, setShiftSaving] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);

  const [patternCode, setPatternCode] = useState("");
  const [patternName, setPatternName] = useState("");
  const [dayShifts, setDayShifts] = useState<Record<string, string>>({
    sunShiftId: "",
    monShiftId: "",
    tueShiftId: "",
    wedShiftId: "",
    thuShiftId: "",
    friShiftId: "",
    satShiftId: "",
  });
  const [patternSaving, setPatternSaving] = useState(false);
  const [patternError, setPatternError] = useState<string | null>(null);

  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [shiftEdit, setShiftEdit] = useState<ShiftEditState | null>(null);
  const [shiftEditSaving, setShiftEditSaving] = useState(false);
  const [shiftEditError, setShiftEditError] = useState<string | null>(null);

  const [editingPatternId, setEditingPatternId] = useState<string | null>(null);
  const [patternEdit, setPatternEdit] = useState<PatternEditState | null>(null);
  const [patternEditSaving, setPatternEditSaving] = useState(false);
  const [patternEditError, setPatternEditError] = useState<string | null>(null);
  const [patternEditOpen, setPatternEditOpen] = useState(false);

  const showSchedule = mode === "full";
  const showAssignPattern = mode !== "overrides";
  const showCreatePattern = mode !== "overrides";
  const showOverrideForm = mode !== "patterns";
  const showOverrideTables = mode !== "patterns";
  const showShifts = mode === "full";
  const showWeeklyPatterns = mode !== "overrides";
  const showPatternsUI =
    showAssignPattern || showCreatePattern || showWeeklyPatterns;

  const countDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    const diff = Math.floor(
      (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff >= 0 ? diff + 1 : 0;
  };

  const overrideDaysCount =
    overrideIsRange && overrideEndDate
      ? countDays(overrideDate, overrideEndDate)
      : 1;

  const selectedRange: DateRange = {
    from: makeDate(overrideDate),
    to: makeDate(overrideEndDate),
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setShiftEditError(null);
      setPatternEditError(null);
      const [scheduleResult, overrideResult, assignmentsResult] =
        await Promise.all([
          getScheduleSnapshot(date),
          listScheduleOverrides({ start: date }),
          listPatternAssignments(),
        ]);
      if (!scheduleResult.success) {
        throw new Error(scheduleResult.error || "Failed to load schedule");
      }
      if (!overrideResult.success) {
        throw new Error(overrideResult.error || "Failed to load overrides");
      }

      setEntries(
        (scheduleResult.schedule ?? []).map((entry: any) => ({
          ...entry,
          shift: entry.shift ? normalizeShift(entry.shift) : null,
        }))
      );
      setPatterns((scheduleResult.patterns ?? []).map(normalizePattern));
      setShifts((scheduleResult.shifts ?? []).map(normalizeShift));
      setOverrides((overrideResult.data ?? []).map(normalizeOverride));

      if (assignmentsResult.success && Array.isArray(assignmentsResult.data)) {
        setPatternAssignments(
          assignmentsResult.data.map((a: any) => ({
            ...a,
            pattern: a.pattern ? normalizePattern(a.pattern) : null,
            isLatest: a.isLatest,
          }))
        );
      } else {
        setPatternAssignments([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employees = useMemo(() => entries.map((e) => e.employee), [entries]);
  const selectedDayKey = date;
  const overrideDayKey = (value: string) =>
    new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });

  const overridesForDay = useMemo(
    () =>
      overrides.filter((o) => overrideDayKey(o.workDate) === selectedDayKey),
    [overrides, selectedDayKey]
  );
  const upcomingOverrides = useMemo(
    () => overrides.filter((o) => overrideDayKey(o.workDate) > selectedDayKey),
    [overrides, selectedDayKey]
  );

  const startShiftEdit = (shift: ShiftLite) => {
    setEditingShiftId(shift.id);
    setShiftEdit({
      code: shift.code,
      name: shift.name,
      startTime: minutesToTimeInput(shift.startMinutes),
      endTime: minutesToTimeInput(shift.endMinutes),
      spansMidnight: Boolean(shift.spansMidnight),
      breakStartTime:
        shift.breakStartMinutes != null
          ? minutesToTimeInput(shift.breakStartMinutes)
          : "",
      breakEndTime:
        shift.breakEndMinutes != null
          ? minutesToTimeInput(shift.breakEndMinutes)
          : "",
      notes: shift.notes ?? "",
    });
    setShiftEditError(null);
  };

  const cancelShiftEdit = () => {
    setEditingShiftId(null);
    setShiftEdit(null);
    setShiftEditError(null);
  };

  const saveShiftEdit = async () => {
    if (!editingShiftId || !shiftEdit) return;
    try {
      setShiftEditSaving(true);
      setShiftEditError(null);
      const result = await updateShift({
        id: editingShiftId,
        code: shiftEdit.code,
        name: shiftEdit.name,
        startTime: shiftEdit.startTime,
        endTime: shiftEdit.endTime,
        spansMidnight: shiftEdit.spansMidnight,
        breakStartTime: shiftEdit.breakStartTime ?? null,
        breakEndTime: shiftEdit.breakEndTime ?? null,
        notes: shiftEdit.notes,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to update shift");
      }
      cancelShiftEdit();
      await load();
    } catch (err) {
      setShiftEditError(
        err instanceof Error ? err.message : "Failed to update shift"
      );
    } finally {
      setShiftEditSaving(false);
    }
  };

  const startPatternEdit = (p: Pattern) => {
    setEditingPatternId(p.id);
    setPatternEdit({
      code: p.code,
      name: p.name,
      dayShifts: {
        sunShiftId: p.sunShiftId ? String(p.sunShiftId) : "",
        monShiftId: p.monShiftId ? String(p.monShiftId) : "",
        tueShiftId: p.tueShiftId ? String(p.tueShiftId) : "",
        wedShiftId: p.wedShiftId ? String(p.wedShiftId) : "",
        thuShiftId: p.thuShiftId ? String(p.thuShiftId) : "",
        friShiftId: p.friShiftId ? String(p.friShiftId) : "",
        satShiftId: p.satShiftId ? String(p.satShiftId) : "",
      },
    });
    setPatternEditError(null);
    setPatternEditOpen(true);
  };

  const cancelPatternEdit = () => {
    setEditingPatternId(null);
    setPatternEdit(null);
    setPatternEditError(null);
    setPatternEditOpen(false);
  };

  const savePatternEdit = async () => {
    if (!editingPatternId || !patternEdit) {
      setPatternEditError("No pattern selected");
      return;
    }
    if (!patternEdit.code.trim() || !patternEdit.name.trim()) {
      setPatternEditError("Code and name are required");
      return;
    }
    try {
      setPatternEditSaving(true);
      setPatternEditError(null);
      const payload: Record<string, any> = {
        id: editingPatternId,
        code: patternEdit.code.trim(),
        name: patternEdit.name.trim(),
      };
      Object.entries(patternEdit.dayShifts).forEach(([key, val]) => {
        payload[key] = val ? Number(val) : null;
      });
      const result = await updatePattern(payload as any);
      if (!result.success) {
        throw new Error(result.error || "Failed to update pattern");
      }
      cancelPatternEdit();
      await load();
    } catch (err) {
      setPatternEditError(
        err instanceof Error ? err.message : "Failed to update pattern"
      );
    } finally {
      setPatternEditSaving(false);
    }
  };

  const handleDeletePattern = async (id: string) => {
    try {
      const result = await deletePatternAction(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete pattern");
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (editingPatternId === id) cancelPatternEdit();
      await load();
    }
  };

  const handleAssign = async () => {
    if (!assignEmployeeId || !assignPatternId) {
      setAssignError("Employee and pattern are required");
      return;
    }
    if (!assignEffective) {
      setAssignError("Effective date is required");
      return;
    }
    try {
      setAssignSaving(true);
      setAssignError(null);
      setAssignSuccess(null);
      const result = await assignPatternToEmployee({
        employeeId: assignEmployeeId,
        patternId: assignPatternId,
        effectiveDate: assignEffective,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to assign pattern");
      }
      const emp = employees.find((e) => e.employeeId === assignEmployeeId);
      const pat = patterns.find((p) => p.id === assignPatternId);
      if (emp && pat) {
        setAssignSuccess(
          `Assigned ${emp.firstName} ${emp.lastName} to ${pat.name}`
        );
      } else {
        setAssignSuccess("Pattern assigned successfully");
      }
      await load();
    } catch (err) {
      setAssignError(
        err instanceof Error ? err.message : "Failed to assign pattern"
      );
    } finally {
      setAssignSaving(false);
    }
  };

  const handleOverride = async () => {
    if (!overrideEmployeeId) {
      setOverrideError("Employee is required");
      return false;
    }
    if (!overrideDate) {
      setOverrideError("Start date is required");
      return false;
    }
    if (overrideIsRange && !overrideEndDate) {
      setOverrideError("End date is required for a range");
      return false;
    }
    if (
      overrideIsRange &&
      overrideEndDate &&
      new Date(overrideEndDate) < new Date(overrideDate)
    ) {
      setOverrideError("End date must be on or after start date");
      return false;
    }
    try {
      setOverrideSaving(true);
      setOverrideError(null);
      const dates: string[] = (() => {
        if (!overrideIsRange || !overrideEndDate) return [overrideDate];
        const start = new Date(overrideDate);
        const end = new Date(overrideEndDate);
        const days: string[] = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          days.push(d.toISOString().slice(0, 10));
        }
        return days;
      })();

      for (const day of dates) {
        const result = await upsertScheduleOverride({
          employeeId: overrideEmployeeId,
          shiftId: overrideShiftId ? Number(overrideShiftId) : null,
          workDate: day,
          source: overrideSource,
        });
        if (!result.success) {
          throw new Error(
            result.error || `Failed to save override for ${day}`
          );
        }
      }
      await load();
      // Reset form after applying
      setOverrideEmployeeId("");
      setOverrideShiftId("");
      setOverrideDate("");
      setOverrideEndDate(null);
      setOverrideIsRange(false);
      return true;
    } catch (err) {
      setOverrideError(
        err instanceof Error ? err.message : "Failed to save override"
      );
      return false;
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleCreatePattern = async () => {
    if (!patternCode.trim() || !patternName.trim()) {
      setPatternError("Code and name are required");
      return;
    }
    try {
      setPatternSaving(true);
      setPatternError(null);
      const payload: Record<string, any> = {
        code: patternCode,
        name: patternName,
      };
      Object.entries(dayShifts).forEach(([key, val]) => {
        payload[key] = val ? Number(val) : null;
      });
      const result = await createPattern(payload as any);
      if (!result.success) {
        throw new Error(result.error || "Failed to create pattern");
      }
      setPatternCode("");
      setPatternName("");
      setDayShifts({
        sunShiftId: "",
        monShiftId: "",
        tueShiftId: "",
        wedShiftId: "",
        thuShiftId: "",
        friShiftId: "",
        satShiftId: "",
      });
      await load();
    } catch (err) {
      setPatternError(
        err instanceof Error ? err.message : "Failed to create pattern"
      );
    } finally {
      setPatternSaving(false);
    }
  };

  const handleCreateShift = async () => {
    if (!shiftCode.trim() || !shiftName.trim()) {
      setShiftError("Code and name are required");
      return;
    }
    try {
      setShiftSaving(true);
      setShiftError(null);
      const result = await createShift({
        code: shiftCode,
        name: shiftName,
        startTime: shiftStart,
        endTime: shiftEnd,
        spansMidnight: shiftSpansMidnight,
        breakStartTime: shiftBreakStart || null,
        breakEndTime: shiftBreakEnd || null,
        notes: shiftNotes,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to create shift");
      }
      setShiftCode("");
      setShiftName("");
      setShiftNotes("");
      setShiftBreakStart("");
      setShiftBreakEnd("");
      await load();
    } catch (err) {
      setShiftError(
        err instanceof Error ? err.message : "Failed to create shift"
      );
    } finally {
      setShiftSaving(false);
    }
  };

  const handleRangeSelect = (value?: DateRange) => {
    if (!value) {
      setOverrideDate("");
      setOverrideEndDate(null);
      setOverrideIsRange(false);
      return;
    }
    if (value.from) {
      setOverrideDate(value.from.toLocaleDateString("en-CA", { timeZone: TZ }));
    }
    if (value.to) {
      setOverrideEndDate(
        value.to.toLocaleDateString("en-CA", { timeZone: TZ })
      );
      setOverrideIsRange(true);
    } else {
      setOverrideEndDate(null);
      setOverrideIsRange(false);
    }
  };

  const clearOverrideSelection = () => {
    setOverrideDate("");
    setOverrideEndDate(null);
    setOverrideIsRange(false);
  };

  const startOverrideEdit = (o: OverrideRow) => {
    setOverrideEmployeeId(o.employee.employeeId);
    setOverrideShiftId(o.shift ? String(o.shift.id) : "");
    setOverrideDate(toDateInputValue(o.workDate));
    setOverrideIsRange(false);
    setOverrideEndDate(null);
    setEditingOverride(o);
    setOverrideEditOpen(true);
  };

  const deleteOverride = async (id: string) => {
    const result = await deleteScheduleOverride(id);
    if (!result.success) {
      setOverrideError(result.error || "Failed to delete override");
      return;
    }
    await load();
  };

  const handleOverrideEditOpenChange = (open: boolean) => {
    setOverrideEditOpen(open);
    if (!open) setEditingOverride(null);
  };

  const handlePatternEditOpenChange = (open: boolean) => {
    if (open) setPatternEditOpen(true);
    else cancelPatternEdit();
  };

  const handleShiftFormChange = (
    field: string,
    value: string | number | boolean
  ) => {
    switch (field) {
      case "code":
        setShiftCode(String(value));
        break;
      case "name":
        setShiftName(String(value));
        break;
      case "start":
        setShiftStart(String(value));
        break;
      case "end":
        setShiftEnd(String(value));
        break;
      case "breakStart":
        setShiftBreakStart(String(value));
        break;
      case "breakEnd":
        setShiftBreakEnd(String(value));
        break;
      case "spansMidnight":
        setShiftSpansMidnight(Boolean(value));
        break;
      case "notes":
        setShiftNotes(String(value));
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-6">
      {showSchedule && (
        <DailyScheduleCard
          date={date}
          entries={entries}
          loading={loading}
          error={error}
          onDateChange={setDate}
          onReload={load}
        />
      )}

      {showPatternsUI && (
        <PatternsSection
          showAssignPattern={showAssignPattern}
          showCreatePattern={showCreatePattern}
          showWeeklyPatterns={showWeeklyPatterns}
          employees={employees}
          patterns={patterns}
          shifts={shifts}
          assignments={patternAssignments}
          assignEmployeeId={assignEmployeeId}
          assignPatternId={assignPatternId}
          assignEffective={assignEffective}
          assignError={assignError}
          assignSaving={assignSaving}
          assignSuccess={assignSuccess}
          onRefresh={load}
          onAssignEmployeeChange={setAssignEmployeeId}
          onAssignPatternChange={setAssignPatternId}
          onAssignEffectiveChange={setAssignEffective}
          onAssignSubmit={handleAssign}
          editingPatternId={editingPatternId}
          patternCode={patternCode}
          patternName={patternName}
          dayShifts={dayShifts}
          patternSaving={patternSaving}
          patternError={patternError}
          onPatternCodeChange={setPatternCode}
          onPatternNameChange={setPatternName}
          onDayShiftChange={(key, value) =>
            setDayShifts((prev) => ({ ...prev, [key]: value }))
          }
          onCreatePattern={handleCreatePattern}
          onDeletePattern={handleDeletePattern}
          onStartEditPattern={startPatternEdit}
          patternEditOpen={patternEditOpen}
          onPatternEditOpenChange={handlePatternEditOpenChange}
          patternEdit={patternEdit}
          patternEditError={patternEditError}
          patternEditSaving={patternEditSaving}
          onPatternEditChange={(value) => setPatternEdit(value)}
          onSavePatternEdit={savePatternEdit}
          onCancelPatternEdit={cancelPatternEdit}
          onDeleteAssignment={async (id) => {
            const result = await deletePatternAssignment(id);
            if (!result.success) {
              setAssignError(result.error || "Failed to delete assignment");
              return;
            }
            await load();
          }}
        />
      )}

      <OverridesSection
        showOverrideForm={showOverrideForm}
        showOverrideTables={showOverrideTables}
        employees={employees}
        shifts={shifts}
        overrideEmployeeId={overrideEmployeeId}
        overrideShiftId={overrideShiftId}
        overrideDate={overrideDate}
        overrideEndDate={overrideEndDate}
        overrideIsRange={overrideIsRange}
        overrideError={overrideError}
        overrideSaving={overrideSaving}
        overrideDaysCount={overrideDaysCount}
        selectedRange={selectedRange}
        overridesForDay={overridesForDay}
        upcomingOverrides={upcomingOverrides}
        onRefresh={load}
        overridePickerOpen={overridePickerOpen}
        onOverridePickerOpenChange={setOverridePickerOpen}
        overrideEditOpen={overrideEditOpen}
        onOverrideEditOpenChange={handleOverrideEditOpenChange}
        editingOverride={editingOverride}
        onOverrideEmployeeChange={setOverrideEmployeeId}
        onOverrideShiftChange={setOverrideShiftId}
        onRangeSelect={handleRangeSelect}
        onClearSelection={clearOverrideSelection}
        onOpenCalendar={() => setOverridePickerOpen(true)}
        onSaveOverride={handleOverride}
        onOverrideDateChange={setOverrideDate}
        onStartEditOverride={startOverrideEdit}
        onDeleteOverride={deleteOverride}
      />

      <ShiftsSection
        showShifts={showShifts}
        shifts={shifts}
        shiftEditId={editingShiftId}
        shiftEdit={shiftEdit}
        shiftEditSaving={shiftEditSaving}
        shiftEditError={shiftEditError}
        shiftCode={shiftCode}
        shiftName={shiftName}
        shiftStart={shiftStart}
        shiftEnd={shiftEnd}
        shiftSpansMidnight={shiftSpansMidnight}
        shiftBreakStart={shiftBreakStart}
        shiftBreakEnd={shiftBreakEnd}
        shiftNotes={shiftNotes}
        shiftSaving={shiftSaving}
        shiftError={shiftError}
        onRefresh={load}
        onStartEdit={startShiftEdit}
        onChangeEdit={(value) => setShiftEdit(value)}
        onSaveEdit={saveShiftEdit}
        onCancelEdit={cancelShiftEdit}
        onDeleteShift={async (id) => {
          const result = await deleteShift(id);
          if (!result.success) {
            setShiftEditError(result.error || "Failed to delete shift");
            return;
          }
          await load();
        }}
        onCreateShift={handleCreateShift}
        onChangeField={handleShiftFormChange}
      />
    </div>
  );
}
