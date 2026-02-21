import { DateRange } from "react-day-picker";
import { TZ } from "@/lib/timezone";

export type EmployeeLite = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department?: { name: string | null } | null;
  position?: { name: string | null } | null;
};

export type ShiftLite = {
  id: number;
  code: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
  spansMidnight?: boolean;
  breakStartMinutes?: number | null;
  breakEndMinutes?: number | null;
  breakMinutesUnpaid?: number | null;
  paidHoursPerDay?: number | null;
  notes?: string | null;
};

export type Pattern = {
  id: string;
  code: string;
  name: string;
  sunShiftId: number | null;
  monShiftId: number | null;
  tueShiftId: number | null;
  wedShiftId: number | null;
  thuShiftId: number | null;
  friShiftId: number | null;
  satShiftId: number | null;
  sunShift?: ShiftLite | null;
  monShift?: ShiftLite | null;
  tueShift?: ShiftLite | null;
  wedShift?: ShiftLite | null;
  thuShift?: ShiftLite | null;
  friShift?: ShiftLite | null;
  satShift?: ShiftLite | null;
};

export type ScheduleEntry = {
  employee: EmployeeLite;
  shift: ShiftLite | null;
  source: "override" | "pattern" | "none";
  scheduledStartMinutes: number | null;
  scheduledEndMinutes: number | null;
};

export type OverrideRow = {
  id: string;
  workDate: string;
  source: string;
  note?: string | null;
  employee: EmployeeLite;
  shift: ShiftLite | null;
};

export type PatternAssignment = {
  id: string;
  employeeId: string;
  effectiveDate: string;
  reason?: string | null;
  sunShiftIdSnapshot?: number | null;
  monShiftIdSnapshot?: number | null;
  tueShiftIdSnapshot?: number | null;
  wedShiftIdSnapshot?: number | null;
  thuShiftIdSnapshot?: number | null;
  friShiftIdSnapshot?: number | null;
  satShiftIdSnapshot?: number | null;
  employee: EmployeeLite;
  pattern: Pattern | null;
  isLatest?: boolean;
};

export const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: TZ });

export const formatMinutes = (minutes: number | null) => {
  if (minutes == null) return "—";
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
};

export const minutesToTimeInput = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

export const formatDateDisplay = (value: string) => {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });
};

export const normalizeShift = (s: any): ShiftLite => ({
  id: s.id,
  code: s.code,
  name: s.name,
  startMinutes: s.startMinutes,
  endMinutes: s.endMinutes,
  spansMidnight: Boolean(s.spansMidnight),
  breakStartMinutes:
    typeof s.breakStartMinutes === "number" ? s.breakStartMinutes : null,
  breakEndMinutes: typeof s.breakEndMinutes === "number" ? s.breakEndMinutes : null,
  breakMinutesUnpaid:
    typeof s.breakMinutesUnpaid === "number" ? s.breakMinutesUnpaid : 0,
  paidHoursPerDay:
    s.paidHoursPerDay != null
      ? typeof s.paidHoursPerDay === "number"
        ? s.paidHoursPerDay
        : Number(s.paidHoursPerDay)
      : 0,
  notes: s.notes ?? "",
});

export const normalizePattern = (p: any): Pattern => ({
  id: p.id,
  code: p.code,
  name: p.name,
  sunShiftId: p.sunShiftId ?? null,
  monShiftId: p.monShiftId ?? null,
  tueShiftId: p.tueShiftId ?? null,
  wedShiftId: p.wedShiftId ?? null,
  thuShiftId: p.thuShiftId ?? null,
  friShiftId: p.friShiftId ?? null,
  satShiftId: p.satShiftId ?? null,
  sunShift: p.sunShift ? normalizeShift(p.sunShift) : null,
  monShift: p.monShift ? normalizeShift(p.monShift) : null,
  tueShift: p.tueShift ? normalizeShift(p.tueShift) : null,
  wedShift: p.wedShift ? normalizeShift(p.wedShift) : null,
  thuShift: p.thuShift ? normalizeShift(p.thuShift) : null,
  friShift: p.friShift ? normalizeShift(p.friShift) : null,
  satShift: p.satShift ? normalizeShift(p.satShift) : null,
});

export const normalizeOverride = (o: any): OverrideRow => ({
  id: o.id,
  workDate: o.workDate,
  source: o.source,
  note: o.note ?? "",
  employee: o.employee,
  shift: o.shift ? normalizeShift(o.shift) : null,
});

export const toDateInputValue = (value: string) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });

export const formatRangeLabel = (range: DateRange) => {
  const fmt = (d?: Date) =>
    d
      ? d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: TZ,
        })
      : "";
  return range?.from
    ? `${fmt(range.from)}${range.to ? ` → ${fmt(range.to)}` : ""}`
    : "Pick dates";
};

export const makeDate = (val?: string | null) => {
  if (!val) return undefined;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export const patternLabel = (p: Pattern) => {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const first = days
    .map((d) => (p as any)[`${d}Shift`] as ShiftLite | undefined | null)
    .find((s) => s);
  return `${p.name}${first ? ` • ${first.name}` : ""}`;
};
