import { TZ } from "@/lib/timezone";

export const shiftSelect = {
  id: true,
  code: true,
  name: true,
  startMinutes: true,
  endMinutes: true,
  spansMidnight: true,
  breakStartMinutes: true,
  breakEndMinutes: true,
  breakMinutesUnpaid: true,
  paidHoursPerDay: true,
  notes: true,
};

export type DayShiftKey =
  | "sunShiftId"
  | "monShiftId"
  | "tueShiftId"
  | "wedShiftId"
  | "thuShiftId"
  | "friShiftId"
  | "satShiftId";

export type DayShiftMap = Record<DayShiftKey, number | null>;

export const toTzDateKey = (value: Date) =>
  value.toLocaleDateString("en-CA", { timeZone: TZ });
