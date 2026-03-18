import { TZ } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type {
  PayrollReviewDecisionValue,
  PayrollStatusValue,
  PayrollTypeValue,
} from "@/types/payroll";

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const rangeDateParts = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-PH", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).formatToParts(new Date(value));

  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";

  return { month, day, year };
};

export const formatDateRange = (start: string, end: string) => {
  if (!start || !end) return "—";

  const startParts = rangeDateParts(start);
  const endParts = rangeDateParts(end);

  if (
    startParts.year === endParts.year &&
    startParts.month === endParts.month &&
    startParts.day === endParts.day
  ) {
    return `${startParts.month} ${startParts.day}, ${startParts.year}`;
  }

  if (startParts.year === endParts.year && startParts.month === endParts.month) {
    return `${startParts.month} ${startParts.day} - ${endParts.day}, ${startParts.year}`;
  }

  if (startParts.year === endParts.year) {
    return `${startParts.month} ${startParts.day} - ${endParts.month} ${endParts.day}, ${startParts.year}`;
  }

  return `${startParts.month} ${startParts.day}, ${startParts.year} - ${endParts.month} ${endParts.day}, ${endParts.year}`;
};

export const formatMinutes = (minutes: number) => {
  const safe = Math.max(0, Math.floor(minutes));
  const hrs = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

export const humanizePayrollType = (value: PayrollTypeValue) => {
  if (value === "BIMONTHLY") return "Bi-monthly";
  if (value === "MONTHLY") return "Monthly";
  if (value === "OFF_CYCLE") return "Off-cycle";
  return "Weekly";
};

export const payrollTypeClass = (value: PayrollTypeValue) =>
  cn(
    "border",
    value === "BIMONTHLY" && "border-sky-600 text-sky-700",
    value === "MONTHLY" && "border-emerald-600 text-emerald-700",
    value === "WEEKLY" && "border-violet-600 text-violet-700",
    value === "OFF_CYCLE" && "border-amber-600 text-amber-700",
  );

export const statusClass = (status: PayrollStatusValue) =>
  cn(
    "border",
    status === "RELEASED" && "border-emerald-600 text-emerald-700",
    status === "REVIEWED" && "border-blue-600 text-blue-700",
    status === "DRAFT" && "border-orange-600 text-orange-700",
    status === "VOIDED" && "border-destructive text-destructive",
    status === "FINALIZED" && "border-violet-600 text-violet-700",
  );

export const decisionClass = (decision: PayrollReviewDecisionValue) =>
  cn(
    "border",
    decision === "APPROVED" && "border-emerald-600 text-emerald-700",
    decision === "REJECTED" && "border-destructive text-destructive",
    decision === "PENDING" && "border-orange-600 text-orange-700",
  );
