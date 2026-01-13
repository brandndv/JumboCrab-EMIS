import type { Shift, WeeklyPattern } from "@prisma/client";

type ShiftRecord = Pick<
  Shift,
  | "id"
  | "code"
  | "name"
  | "startMinutes"
  | "endMinutes"
  | "spansMidnight"
  | "breakStartMinutes"
  | "breakEndMinutes"
  | "breakMinutesUnpaid"
  | "paidHoursPerDay"
  | "notes"
>;

const toStringOrZero = (value: unknown) => {
  if (value === null || typeof value === "undefined") return "0";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof (value as { toString?: () => string })?.toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return "0";
};

export type SerializedShift = {
  id: number;
  code: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
  spansMidnight: boolean;
  breakStartMinutes: number | null;
  breakEndMinutes: number | null;
  breakMinutesUnpaid: number;
  paidHoursPerDay: string;
  notes: string | null;
};

export function serializeShift(shift: ShiftRecord): SerializedShift;
export function serializeShift(
  shift: ShiftRecord | null
): SerializedShift | null;
export function serializeShift(shift: ShiftRecord | null) {
  if (!shift) return null;
  return {
    id: shift.id,
    code: shift.code,
    name: shift.name,
    startMinutes: shift.startMinutes,
    endMinutes: shift.endMinutes,
    spansMidnight: shift.spansMidnight,
    breakStartMinutes: shift.breakStartMinutes,
    breakEndMinutes: shift.breakEndMinutes,
    breakMinutesUnpaid: shift.breakMinutesUnpaid,
    paidHoursPerDay: toStringOrZero(shift.paidHoursPerDay),
    notes: shift.notes ?? null,
  };
}

type PatternWithShifts = WeeklyPattern & {
  sunShift?: ShiftRecord | null;
  monShift?: ShiftRecord | null;
  tueShift?: ShiftRecord | null;
  wedShift?: ShiftRecord | null;
  thuShift?: ShiftRecord | null;
  friShift?: ShiftRecord | null;
  satShift?: ShiftRecord | null;
};

export const serializePattern = (pattern: PatternWithShifts) => ({
  id: pattern.id,
  code: pattern.code,
  name: pattern.name,
  sunShiftId: pattern.sunShiftId ?? null,
  monShiftId: pattern.monShiftId ?? null,
  tueShiftId: pattern.tueShiftId ?? null,
  wedShiftId: pattern.wedShiftId ?? null,
  thuShiftId: pattern.thuShiftId ?? null,
  friShiftId: pattern.friShiftId ?? null,
  satShiftId: pattern.satShiftId ?? null,
  sunShift: pattern.sunShift ? serializeShift(pattern.sunShift) : null,
  monShift: pattern.monShift ? serializeShift(pattern.monShift) : null,
  tueShift: pattern.tueShift ? serializeShift(pattern.tueShift) : null,
  wedShift: pattern.wedShift ? serializeShift(pattern.wedShift) : null,
  thuShift: pattern.thuShift ? serializeShift(pattern.thuShift) : null,
  friShift: pattern.friShift ? serializeShift(pattern.friShift) : null,
  satShift: pattern.satShift ? serializeShift(pattern.satShift) : null,
});
