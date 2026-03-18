import { TZ } from "@/lib/timezone";

export const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof (value as { toString?: () => string })?.toString === "function") {
    const parsed = Number.parseFloat(
      (value as { toString: () => string }).toString(),
    );
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const toNumber = (value: unknown, fallback = 0) =>
  toNumberOrNull(value) ?? fallback;

export const roundCurrency = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export const roundSixDecimals = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * 1_000_000) / 1_000_000;

export const toIsoString = (value: Date | string | null | undefined) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
};

export const toDateKeyInTz = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });

export const isDateKeyInRange = (
  dateKey: string,
  startKey: string,
  endKey: string,
) => dateKey >= startKey && dateKey <= endKey;

export const parseIsoDateAtNoonUtc = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

export const shiftDateByDays = (date: Date, days: number) => {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
};

export const toPercent = (value: number) => value / 100;
