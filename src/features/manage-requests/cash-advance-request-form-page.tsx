"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isBefore,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { GovernmentLoanAgency, LeaveRequestType } from "@prisma/client";
import {
  createCashAdvanceRequest,
  createDayOffRequest,
  createGovernmentLoanAssistanceRequest,
  createLeaveRequest,
  createSilEncashmentRequest,
  createScheduleChangeRequest,
  createScheduleSwapRequest,
  getDayOffPreview,
  getEmployeeLeaveBalanceSummary,
  getScheduleChangePreview,
  getScheduleSwapPreview,
  listEmployeesForScheduleSwap,
  listScheduleChangeShifts,
  type DayOffPreview,
  type EmployeeLeaveBalanceSummary,
  type ScheduleChangePreview,
  type ScheduleChangeShiftOption,
  type ScheduleSwapEmployeeOption,
  type ScheduleSwapPreview,
} from "@/actions/requests/requests-action";
import { getEmployeeMonthSchedule } from "@/actions/schedule/schedule-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { TZ } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import {
  countDaysInclusive,
  formatDate,
  formatDateRange,
  formatMoney,
  leaveTypeLabel,
  requestTypeLabel,
} from "@/features/manage-requests/request-ui-helpers";

type RequestType =
  | "CASH_ADVANCE"
  | "GOVERNMENT_LOAN"
  | "SIL_ENCASHMENT"
  | "DAY_OFF"
  | "LEAVE"
  | "SCHEDULE_CHANGE"
  | "SCHEDULE_SWAP";

type RequestFormPageProps = {
  lockedRequestType?: RequestType;
};

type CashAdvanceStartOption = {
  value: string;
  title: string;
  subtitle: string;
};

const REQUEST_TYPE_GROUPS: Array<{
  label: string;
  options: RequestType[];
}> = [
  { label: "Time off", options: ["LEAVE", "SIL_ENCASHMENT"] },
  {
    label: "Schedule",
    options: ["DAY_OFF", "SCHEDULE_CHANGE", "SCHEDULE_SWAP"],
  },
  { label: "Finance", options: ["CASH_ADVANCE", "GOVERNMENT_LOAN"] },
];

const REQUEST_TYPE_DESCRIPTIONS: Record<RequestType, string> = {
  LEAVE: "Book continuous leave dates, review remaining credits, and send for approval.",
  SIL_ENCASHMENT:
    "Convert available current-year SIL credits to cash after manager approval.",
  DAY_OFF: "Move an off day to another workday by picking source and target dates.",
  SCHEDULE_CHANGE:
    "Request a shift replacement across one day or a selected range of workdays.",
  SCHEDULE_SWAP:
    "Pick one scheduled workday, then request a same-date swap with a coworker.",
  CASH_ADVANCE:
    "Request an advance amount now. Approved requests are deducted one time on the next payroll.",
  GOVERNMENT_LOAN:
    "Request help preparing an SSS or Pag-IBIG loan application and record agency results.",
};

const buildUpcomingBimonthlyStartOptions = (): CashAdvanceStartOption[] => {
  const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const today = new Date(Date.UTC(
    nowInTz.getFullYear(),
    nowInTz.getMonth(),
    nowInTz.getDate(),
    12,
    0,
    0,
  ));

  const options: CashAdvanceStartOption[] = [];

  for (let monthOffset = 0; monthOffset < 4 && options.length < 4; monthOffset += 1) {
    const baseYear = nowInTz.getFullYear();
    const baseMonth = nowInTz.getMonth() + monthOffset;
    const year = baseYear + Math.floor(baseMonth / 12);
    const month = ((baseMonth % 12) + 12) % 12;
    const lastDay = new Date(year, month + 1, 0).getDate();

    const makeDate = (day: number) => new Date(Date.UTC(year, month, day, 12, 0, 0));
    const firstStart = makeDate(1);
    const firstEnd = makeDate(15);
    const secondStart = makeDate(16);
    const secondEnd = makeDate(lastDay);

    [
      {
        start: firstStart,
        label: "1st half",
        range: `${formatDate(toDateInputValue(firstStart))} - ${formatDate(
          toDateInputValue(firstEnd),
        )}`,
      },
      {
        start: secondStart,
        label: "2nd half",
        range: `${formatDate(toDateInputValue(secondStart))} - ${formatDate(
          toDateInputValue(secondEnd),
        )}`,
      },
    ].forEach((entry) => {
      if (entry.start.getTime() < today.getTime()) {
        return;
      }
      options.push({
        value: toDateInputValue(entry.start),
        title: formatDate(toDateInputValue(entry.start)),
        subtitle: `${entry.label} • ${entry.range}`,
      });
    });
  }

  return options.slice(0, 4);
};

type RequestCalendarDay = {
  date: string;
  shift: {
    id: number;
    code: string;
    name: string;
    colorHex?: string | null;
    isDayOff?: boolean;
    startMinutes: number;
    endMinutes: number;
    spansMidnight: boolean;
    breakStartMinutes: number | null;
    breakEndMinutes: number | null;
    breakMinutesUnpaid: number;
    paidHoursPerDay: string;
    notes: string | null;
  } | null;
  source: "override" | "weekly_schedule" | "none";
  leave: {
    requestId: string | null;
    leaveType: "VACATION" | "SICK" | "SIL" | "PERSONAL" | "EMERGENCY" | "UNPAID";
    isPaidLeave: boolean;
  } | null;
  scheduledStartMinutes: number | null;
  scheduledEndMinutes: number | null;
};

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);
const fromDateInputValue = (value: string) =>
  new Date(`${value}T12:00:00+08:00`);

const leaveTypeOptions: Array<Extract<LeaveRequestType, "SICK" | "SIL" | "UNPAID">> =
  ["SICK", "SIL", "UNPAID"];

const monthDayLabel = (month: number, day: number) =>
  new Date(
    `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00+08:00`,
  ).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

const formatMinutes = (minutes: number | null | undefined) => {
  if (minutes == null) return "—";
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
};

const bookingShiftStyle = (shift?: RequestCalendarDay["shift"] | null) =>
  shift?.colorHex
    ? {
        borderColor: shift.colorHex,
        backgroundColor: `${shift.colorHex}18`,
        color: shift.colorHex,
      }
    : undefined;

const isBetweenInclusive = (dayKey: string, start: string, end: string) =>
  dayKey >= start && dayKey <= end;

const resolveNextRange = (currentStart: string, currentEnd: string, clicked: string) => {
  if (!currentStart || !currentEnd || currentStart !== currentEnd) {
    return { start: clicked, end: clicked };
  }
  if (clicked < currentStart) {
    return { start: clicked, end: currentStart };
  }
  if (clicked === currentStart) {
    return { start: clicked, end: clicked };
  }
  return { start: currentStart, end: clicked };
};

const leaveTypeBadge = (leaveType: RequestCalendarDay["leave"] extends infer T
  ? T extends { leaveType: infer U }
    ? U
    : never
  : never) => {
  switch (leaveType) {
    case "SICK":
      return "Sick";
    case "SIL":
      return "SIL";
    case "UNPAID":
      return "Unpaid";
    case "VACATION":
      return "Vacation";
    case "PERSONAL":
      return "Personal";
    case "EMERGENCY":
      return "Emergency";
    default:
      return "Leave";
  }
};

export default function CashAdvanceRequestFormPage({
  lockedRequestType,
}: RequestFormPageProps) {
  const router = useRouter();
  const toast = useToast();
  const { employee } = useSession();
  const requestTypeOptions = lockedRequestType
    ? [lockedRequestType]
    : ([
        "LEAVE",
        "DAY_OFF",
        "SCHEDULE_CHANGE",
        "SCHEDULE_SWAP",
        "SIL_ENCASHMENT",
        "CASH_ADVANCE",
        "GOVERNMENT_LOAN",
      ] as const);
  const [requestType, setRequestType] = useState<RequestType>(
    lockedRequestType ?? "LEAVE",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leaveSummary, setLeaveSummary] =
    useState<EmployeeLeaveBalanceSummary | null>(null);
  const [leaveType, setLeaveType] = useState<LeaveRequestType>("SICK");
  const [leaveStartDate, setLeaveStartDate] = useState(toDateInputValue(new Date()));
  const [leaveEndDate, setLeaveEndDate] = useState(toDateInputValue(new Date()));
  const [leaveReason, setLeaveReason] = useState("");
  const [silEncashDays, setSilEncashDays] = useState("1");
  const [silEncashRemarks, setSilEncashRemarks] = useState("");

  const [sourceOffDate, setSourceOffDate] = useState("");
  const [targetWorkDate, setTargetWorkDate] = useState("");
  const [dayOffPreview, setDayOffPreview] = useState<DayOffPreview | null>(null);
  const [dayOffReason, setDayOffReason] = useState("");

  const [scheduleChangeStartDate, setScheduleChangeStartDate] = useState("");
  const [scheduleChangeEndDate, setScheduleChangeEndDate] = useState("");
  const [scheduleChangeShifts, setScheduleChangeShifts] = useState<
    ScheduleChangeShiftOption[]
  >([]);
  const [scheduleChangeShiftId, setScheduleChangeShiftId] = useState("");
  const [scheduleChangePreview, setScheduleChangePreview] =
    useState<ScheduleChangePreview | null>(null);
  const [scheduleChangeReason, setScheduleChangeReason] = useState("");

  const [swapWorkDate, setSwapWorkDate] = useState("");
  const [swapCoworkers, setSwapCoworkers] = useState<ScheduleSwapEmployeeOption[]>([]);
  const [swapCoworkerId, setSwapCoworkerId] = useState("");
  const [swapPreview, setSwapPreview] = useState<ScheduleSwapPreview | null>(null);
  const [swapReason, setSwapReason] = useState("");

  const [cashAmount, setCashAmount] = useState("");
  const [cashPreferredStartDate, setCashPreferredStartDate] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [governmentLoanAgency, setGovernmentLoanAgency] =
    useState<GovernmentLoanAgency>(GovernmentLoanAgency.SSS_SALARY_LOAN);
  const [governmentLoanAmount, setGovernmentLoanAmount] = useState("");
  const [governmentLoanTermMonths, setGovernmentLoanTermMonths] =
    useState<12 | 24>(12);
  const [governmentLoanRemarks, setGovernmentLoanRemarks] = useState("");

  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [calendarDays, setCalendarDays] = useState<RequestCalendarDay[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const isLeaveOnly = lockedRequestType === "LEAVE";
  const exitHref = isLeaveOnly ? "/employee/requests/leave" : "/employee/requests";
  const todayKey = toDateInputValue(new Date());

  const leaveDays = countDaysInclusive(leaveStartDate, leaveEndDate) ?? 0;
  const leaveBucket =
    leaveType === "SICK"
      ? leaveSummary?.sick ?? null
      : leaveType === "SIL"
        ? leaveSummary?.sil ?? null
        : null;
  const today = new Date();
  const silMinDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const silBlocked =
    leaveType === "SIL" &&
    new Date(`${leaveStartDate}T00:00:00+08:00`).getTime() <
      new Date(silMinDate.toISOString().slice(0, 10) + "T00:00:00+08:00").getTime();
  const leaveCreditBlocked =
    leaveBucket != null &&
    (leaveBucket.remaining <= 0 || leaveDays > leaveBucket.remaining);
  const leaveInlineError = silBlocked
    ? "SIL must be requested at least 14 days in advance."
    : leaveCreditBlocked
      ? `Only ${leaveBucket?.remaining ?? 0} credit(s) remaining. Choose unpaid leave instead.`
      : null;

  const loadLeaveSummary = useCallback(async () => {
    const result = await getEmployeeLeaveBalanceSummary();
    if (!result.success) {
      setError(result.error || "Failed to load leave credits.");
      return;
    }
    setLeaveSummary(result.data ?? null);
  }, []);

  const loadScheduleChangeShifts = useCallback(async () => {
    const result = await listScheduleChangeShifts({ limit: 100 });
    if (!result.success) {
      setError(result.error || "Failed to load shifts.");
      return;
    }
    setScheduleChangeShifts(result.data ?? []);
  }, []);

  const loadSwapCoworkers = useCallback(async () => {
    const result = await listEmployeesForScheduleSwap({ limit: 100 });
    if (!result.success) {
      setError(result.error || "Failed to load coworkers.");
      return;
    }
    setSwapCoworkers(result.data ?? []);
  }, []);

  const loadCalendarMonth = useCallback(async () => {
    if (
      !employee?.employeeId ||
      requestType === "CASH_ADVANCE" ||
      requestType === "SIL_ENCASHMENT" ||
      requestType === "GOVERNMENT_LOAN"
    ) {
      setCalendarDays([]);
      return;
    }
    try {
      setCalendarLoading(true);
      setCalendarError(null);
      const result = await getEmployeeMonthSchedule({
        employeeId: employee.employeeId,
        anchorDate: toDateInputValue(calendarMonth),
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to load booking calendar.");
      }
      setCalendarDays((result.days ?? []) as RequestCalendarDay[]);
    } catch (err) {
      setCalendarDays([]);
      setCalendarError(
        err instanceof Error ? err.message : "Failed to load booking calendar.",
      );
    } finally {
      setCalendarLoading(false);
    }
  }, [calendarMonth, employee?.employeeId, requestType]);

  useEffect(() => {
    if (requestType === "LEAVE" || requestType === "SIL_ENCASHMENT") {
      void loadLeaveSummary();
      return;
    }
    if (requestType === "SCHEDULE_CHANGE") {
      void loadScheduleChangeShifts();
      return;
    }
    if (requestType === "SCHEDULE_SWAP") {
      void loadSwapCoworkers();
    }
  }, [
    loadLeaveSummary,
    loadScheduleChangeShifts,
    loadSwapCoworkers,
    requestType,
  ]);

  const cashAdvanceStartOptions = useMemo(
    () => buildUpcomingBimonthlyStartOptions(),
    [],
  );
  const governmentLoanAmountNumber = Number(governmentLoanAmount) || 0;
  const governmentLoanEstimatedMonthly =
    governmentLoanAmountNumber > 0
      ? governmentLoanAmountNumber / governmentLoanTermMonths
      : 0;
  const governmentLoanEstimatedPerPayroll =
    governmentLoanEstimatedMonthly > 0 ? governmentLoanEstimatedMonthly / 2 : 0;

  useEffect(() => {
    if (!cashPreferredStartDate && cashAdvanceStartOptions[0]) {
      setCashPreferredStartDate(cashAdvanceStartOptions[0].value);
    }
  }, [cashAdvanceStartOptions, cashPreferredStartDate]);

  useEffect(() => {
    void loadCalendarMonth();
  }, [loadCalendarMonth]);

  useEffect(() => {
    setError(null);
  }, [requestType]);

  useEffect(() => {
    if (
      requestType !== "DAY_OFF" ||
      !sourceOffDate ||
      !targetWorkDate ||
      sourceOffDate === targetWorkDate
    ) {
      setDayOffPreview(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getDayOffPreview({
        sourceOffDate,
        targetWorkDate,
      });
      if (cancelled) return;
      if (!result.success) {
        setDayOffPreview(null);
        return;
      }
      setDayOffPreview(result.data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [requestType, sourceOffDate, targetWorkDate]);

  useEffect(() => {
    if (
      requestType !== "SCHEDULE_CHANGE" ||
      !scheduleChangeShiftId ||
      !scheduleChangeStartDate ||
      !scheduleChangeEndDate
    ) {
      setScheduleChangePreview(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getScheduleChangePreview({
        requestedShiftId: scheduleChangeShiftId,
        startDate: scheduleChangeStartDate,
        endDate: scheduleChangeEndDate,
      });
      if (cancelled) return;
      if (!result.success) {
        setScheduleChangePreview(null);
        return;
      }
      setScheduleChangePreview(result.data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    requestType,
    scheduleChangeShiftId,
    scheduleChangeStartDate,
    scheduleChangeEndDate,
  ]);

  useEffect(() => {
    if (requestType !== "SCHEDULE_SWAP" || !swapCoworkerId || !swapWorkDate) {
      setSwapPreview(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getScheduleSwapPreview({
        coworkerEmployeeId: swapCoworkerId,
        workDate: swapWorkDate,
      });
      if (cancelled) return;
      if (!result.success) {
        setSwapPreview(null);
        return;
      }
      setSwapPreview(result.data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [requestType, swapCoworkerId, swapWorkDate]);

  const selectedShift = useMemo(
    () =>
      scheduleChangeShifts.find((shift) => String(shift.id) === scheduleChangeShiftId) ??
      null,
    [scheduleChangeShiftId, scheduleChangeShifts],
  );

  const organizedScheduleChangeShifts = useMemo(
    () =>
      [...scheduleChangeShifts].sort(
        (left, right) =>
          left.code.localeCompare(right.code) || left.name.localeCompare(right.name),
      ),
    [scheduleChangeShifts],
  );

  const selectedCoworker = useMemo(
    () => swapCoworkers.find((row) => row.employeeId === swapCoworkerId) ?? null,
    [swapCoworkerId, swapCoworkers],
  );

  const organizedSwapCoworkers = useMemo(
    () =>
      [...swapCoworkers].sort(
        (left, right) =>
          left.employeeName.localeCompare(right.employeeName) ||
          left.employeeCode.localeCompare(right.employeeCode),
      ),
    [swapCoworkers],
  );

  const daysByDate = useMemo(() => {
    const map = new Map<string, RequestCalendarDay>();
    calendarDays.forEach((day) => {
      map.set(day.date, day);
    });
    return map;
  }, [calendarDays]);

  const visibleCalendarDates = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 }),
      }),
    [calendarMonth],
  );

  const currentMonthLabel = useMemo(
    () =>
      calendarMonth.toLocaleDateString(undefined, {
        timeZone: TZ,
        month: "long",
        year: "numeric",
      }),
    [calendarMonth],
  );

  const bookingHint =
    requestType === "LEAVE"
      ? "Click one date to start, then another date to extend leave range."
      : requestType === "DAY_OFF"
        ? "Click an OFF day as source, then click a work shift day as target."
        : requestType === "SCHEDULE_CHANGE"
          ? "Click one workday to start, then another workday to extend the change range."
          : requestType === "SCHEDULE_SWAP"
            ? "Click one scheduled workday to request a same-date swap."
            : "";

  const isCalendarSelectionValid = useMemo(() => {
    if (requestType === "LEAVE") return Boolean(leaveStartDate && leaveEndDate);
    if (requestType === "DAY_OFF") return Boolean(sourceOffDate && targetWorkDate);
    if (requestType === "SCHEDULE_CHANGE") {
      return Boolean(
        scheduleChangeShiftId && scheduleChangeStartDate && scheduleChangeEndDate,
      );
    }
    if (requestType === "SCHEDULE_SWAP") return Boolean(swapCoworkerId && swapWorkDate);
    if (requestType === "GOVERNMENT_LOAN") {
      return Boolean(governmentLoanAmount.trim());
    }
    if (requestType === "SIL_ENCASHMENT") {
      return Boolean(silEncashDays.trim());
    }
    return Boolean(cashPreferredStartDate);
  }, [
    cashPreferredStartDate,
    governmentLoanAmount,
    leaveEndDate,
    leaveStartDate,
    requestType,
    scheduleChangeEndDate,
    scheduleChangeShiftId,
    scheduleChangeStartDate,
    silEncashDays,
    sourceOffDate,
    swapCoworkerId,
    swapWorkDate,
    targetWorkDate,
  ]);

  const handleCalendarPick = (dayKey: string) => {
    const day = daysByDate.get(dayKey);
    const clickedDate = fromDateInputValue(dayKey);
    const todayStart = fromDateInputValue(todayKey);
    if (isBefore(clickedDate, todayStart)) {
      return;
    }

    if (requestType === "LEAVE") {
      const next = resolveNextRange(leaveStartDate, leaveEndDate, dayKey);
      setLeaveStartDate(next.start);
      setLeaveEndDate(next.end);
      return;
    }

    if (requestType === "DAY_OFF") {
      if (!day || day.leave || !day.shift) return;
      if (day.shift.isDayOff) {
        setSourceOffDate(dayKey);
      } else {
        setTargetWorkDate(dayKey);
      }
      return;
    }

    if (requestType === "SCHEDULE_CHANGE") {
      if (!day || day.leave || !day.shift || day.shift.isDayOff) return;
      const next = resolveNextRange(
        scheduleChangeStartDate,
        scheduleChangeEndDate,
        dayKey,
      );
      setScheduleChangeStartDate(next.start);
      setScheduleChangeEndDate(next.end);
      return;
    }

    if (requestType === "SCHEDULE_SWAP") {
      if (!day || day.leave || !day.shift || day.shift.isDayOff) return;
      setSwapWorkDate(dayKey);
    }
  };

  const submit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const result =
        requestType === "LEAVE"
          ? await createLeaveRequest({
              leaveType,
              startDate: leaveStartDate,
              endDate: leaveEndDate,
              reason: leaveReason,
            })
          : requestType === "SIL_ENCASHMENT"
            ? await createSilEncashmentRequest({
                days: silEncashDays,
                employeeRemarks: silEncashRemarks,
              })
          : requestType === "DAY_OFF"
            ? await createDayOffRequest({
                sourceOffDate,
                targetWorkDate,
                reason: dayOffReason,
              })
            : requestType === "SCHEDULE_CHANGE"
              ? await createScheduleChangeRequest({
                  startDate: scheduleChangeStartDate,
                  endDate: scheduleChangeEndDate,
                  requestedShiftId: scheduleChangeShiftId,
                  reason: scheduleChangeReason,
                })
              : requestType === "SCHEDULE_SWAP"
                ? await createScheduleSwapRequest({
                    coworkerEmployeeId: swapCoworkerId,
                    workDate: swapWorkDate,
                    reason: swapReason,
                  })
                : requestType === "GOVERNMENT_LOAN"
                  ? await createGovernmentLoanAssistanceRequest({
                      agency: governmentLoanAgency,
                      requestedAmount: governmentLoanAmount,
                      termMonths: governmentLoanTermMonths,
                      employeeRemarks: governmentLoanRemarks,
                    })
                : await createCashAdvanceRequest({
                    amount: cashAmount,
                    preferredStartDate: cashPreferredStartDate,
                    reason: cashReason,
                  });

      if (!result.success) {
        throw new Error(result.error || "Failed to submit request.");
      }

      toast.success(`${requestTypeLabel(requestType)} submitted`, {
        description: "Your request is now waiting for review.",
      });
      router.push(exitHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <Card className="overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-5">
              <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      Request workspace
                    </p>
                    <CardTitle>{isLeaveOnly ? "New Leave Request" : "New Request"}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Compact request flow. Pick dates fast, keep chosen details visible.
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href={exitHref}>Back</Link>
                  </Button>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
                  {!lockedRequestType ? (
                    <div className="space-y-2">
                      <Label>Request type</Label>
                      <Select
                        value={requestType}
                        onValueChange={(value) => setRequestType(value as RequestType)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pick request type" />
                        </SelectTrigger>
                        <SelectContent>
                          {REQUEST_TYPE_GROUPS.map((group, groupIndex) => {
                            const options = group.options.filter((option) =>
                              requestTypeOptions.includes(option),
                            );
                            if (!options.length) {
                              return null;
                            }
                            return (
                              <div key={group.label}>
                                {groupIndex > 0 ? <SelectSeparator /> : null}
                                <SelectGroup>
                                  <SelectLabel>{group.label}</SelectLabel>
                                  {options.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {requestTypeLabel(option)}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </div>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Active flow
                      </p>
                      <p className="mt-2 text-sm font-medium">
                        {requestTypeLabel(requestType)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {REQUEST_TYPE_DESCRIPTIONS[requestType]}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        How to pick
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {requestType === "CASH_ADVANCE"
                          ? "No calendar needed. Enter amount and reason, then submit."
                          : requestType === "SIL_ENCASHMENT"
                            ? "No calendar needed. Choose how many current-year SIL credits to encash."
                          : requestType === "GOVERNMENT_LOAN"
                            ? "Choose agency, amount, and 12 or 24 monthly payments."
                          : bookingHint}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {requestType !== "CASH_ADVANCE" &&
              requestType !== "SIL_ENCASHMENT" &&
              requestType !== "GOVERNMENT_LOAN" ? (
                <Card className="border-border/70">
                  <CardHeader className="border-b border-border/70 pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          Booking Calendar
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{bookingHint}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="min-w-36 text-center text-sm font-medium">
                          {currentMonthLabel}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 p-3">
                    {calendarError ? (
                      <p className="text-sm text-destructive">{calendarError}</p>
                    ) : null}
                    <div className="overflow-x-auto">
                      <div className="w-full max-w-[46rem] min-w-[40rem] space-y-1.5">
                        <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                            <div key={label} className="rounded-md border border-border/50 py-1">
                              {label}
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1.5">
                          {visibleCalendarDates.map((date) => {
                            const dayKey = toDateInputValue(date);
                            const day = daysByDate.get(dayKey) ?? null;
                            const inMonth = isSameMonth(date, calendarMonth);
                            const isPast = isBefore(
                              fromDateInputValue(dayKey),
                              fromDateInputValue(todayKey),
                            );
                            const isLeaveRange =
                              requestType === "LEAVE" &&
                              leaveStartDate &&
                              leaveEndDate &&
                              isBetweenInclusive(dayKey, leaveStartDate, leaveEndDate);
                            const isChangeRange =
                              requestType === "SCHEDULE_CHANGE" &&
                              scheduleChangeStartDate &&
                              scheduleChangeEndDate &&
                              isBetweenInclusive(
                                dayKey,
                                scheduleChangeStartDate,
                                scheduleChangeEndDate,
                              );
                            const isSourceOff =
                              requestType === "DAY_OFF" && sourceOffDate === dayKey;
                            const isTargetWork =
                              requestType === "DAY_OFF" && targetWorkDate === dayKey;
                            const isSwapDate =
                              requestType === "SCHEDULE_SWAP" && swapWorkDate === dayKey;
                            const isSelected =
                              isLeaveRange ||
                              isChangeRange ||
                              isSourceOff ||
                              isTargetWork ||
                              isSwapDate;

                            return (
                              <button
                                key={dayKey}
                                type="button"
                                disabled={!inMonth || isPast}
                                onClick={() => handleCalendarPick(dayKey)}
                                className={cn(
                                  "aspect-square min-h-0 rounded-lg border p-1.5 text-left transition",
                                  inMonth
                                    ? "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/20"
                                    : "border-border/40 bg-muted/10 opacity-40",
                                  isPast && "cursor-not-allowed opacity-50",
                                  isSelected &&
                                    !isSourceOff &&
                                    !isTargetWork &&
                                    "border-primary/70 bg-primary/18 text-primary-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.45)]",
                                  isSelected &&
                                    !isSourceOff &&
                                    !isTargetWork &&
                                    "hover:border-primary/70 hover:bg-primary/18",
                                  isSourceOff &&
                                    "border-amber-500/70 bg-amber-500/18 shadow-[inset_0_0_0_1px_rgb(245_158_11_/_0.45)]",
                                  isSourceOff &&
                                    "hover:border-amber-500/70 hover:bg-amber-500/18",
                                  isTargetWork &&
                                    "border-sky-500/70 bg-sky-500/18 shadow-[inset_0_0_0_1px_rgb(14_165_233_/_0.45)]",
                                  isTargetWork &&
                                    "hover:border-sky-500/70 hover:bg-sky-500/18",
                                )}
                              >
                                <div className="flex h-full flex-col">
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="text-[11px] font-medium text-foreground">
                                      {date.getDate()}
                                    </span>
                                    {day?.leave ? (
                                      <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-medium text-sky-300">
                                        {leaveTypeBadge(day.leave.leaveType)}
                                      </span>
                                    ) : isSourceOff ? (
                                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-medium text-amber-300">
                                        OFF
                                      </span>
                                    ) : isTargetWork ? (
                                      <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-medium text-sky-300">
                                        TGT
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1.5 flex-1">
                                    {day?.shift ? (
                                      <div
                                        className="rounded-md border px-1.5 py-1"
                                        style={bookingShiftStyle(day.shift)}
                                      >
                                        <p className="text-[11px] font-semibold">
                                          {day.shift.code}
                                        </p>
                                        <p className="truncate text-[9px] opacity-80">
                                          {formatMinutes(day.scheduledStartMinutes)} -{" "}
                                          {formatMinutes(day.scheduledEndMinutes)}
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-1.5 py-1 text-[9px] text-muted-foreground">
                                        No shift
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {calendarLoading ? (
                      <p className="text-xs text-muted-foreground">Loading calendar…</p>
                    ) : null}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-border/70">
                  <CardHeader className="border-b border-border/70 pb-3">
                    <div>
                      <CardTitle className="text-base">
                        {requestType === "CASH_ADVANCE"
                          ? "Next Payroll Deduction"
                          : requestType === "SIL_ENCASHMENT"
                            ? "SIL Encashment"
                          : "Agency Application Guide"}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {requestType === "CASH_ADVANCE"
                          ? "Cash advance repayment is deducted one time on the next payroll."
                          : requestType === "SIL_ENCASHMENT"
                            ? "Current-year SIL credits can be converted after manager approval."
                          : "Use official government portals and ask your manager for employer documents when needed."}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {requestType === "CASH_ADVANCE" ? (
                      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
                        <p className="font-medium">
                          {cashAdvanceStartOptions[0]?.title ?? "Next payroll"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {cashAdvanceStartOptions[0]?.subtitle ??
                            "One-time deduction on next payroll."}
                        </p>
                      </div>
                    ) : requestType === "SIL_ENCASHMENT" ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
                          <span className="font-medium">Current SIL balance</span>
                          <span className="mt-2 block text-2xl font-semibold">
                            {leaveSummary?.sil.remaining ?? 0}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            available of {leaveSummary?.sil.annualCredits ?? 0}
                          </span>
                        </div>
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                          <span className="font-medium">Approval required</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Manager approval deducts selected days from SIL credits.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <a
                          href="https://www.sss.gov.ph/salary-loan/"
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm transition hover:border-primary/40"
                        >
                          <span className="font-medium">SSS Salary Loan</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Review official SSS salary loan guidance and My.SSS application steps.
                          </span>
                        </a>
                        <a
                          href="https://www.pagibigfundservices.com/virtualpagibig/Loans.aspx"
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm transition hover:border-primary/40"
                        >
                          <span className="font-medium">Virtual Pag-IBIG Loans</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Open official Pag-IBIG loan services and MPL application resources.
                          </span>
                        </a>
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm md:col-span-2">
                          <p className="font-medium text-amber-800 dark:text-amber-200">
                            Employer documents
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            If SSS/Pag-IBIG requires employer certification, signed documents,
                            or net-pay confirmation, go to your manager for assistance.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="xl:sticky xl:top-6 xl:self-start">
              <Card className="border-border/70">
                <CardHeader className="border-b border-border/70 pb-3">
                  <CardTitle className="text-base">Selection & Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  {requestType === "LEAVE" ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Selected range
                          </p>
                          <p className="mt-2 text-sm font-medium">
                            {formatDateRange(leaveStartDate, leaveEndDate)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {leaveDays || 0} day(s)
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Remaining
                          </p>
                          <p className="mt-2 text-sm font-medium">
                            {leaveBucket ? Math.max(0, leaveBucket.remaining - leaveDays) : "—"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            after approval
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                        <div className="rounded-xl border border-border/70 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Sick
                          </p>
                          <p className="mt-2 text-lg font-semibold">
                            {leaveSummary?.sick.remaining ?? 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            of {leaveSummary?.sick.annualCredits ?? 5}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            SIL
                          </p>
                          <p className="mt-2 text-lg font-semibold">
                            {leaveSummary?.sil.remaining ?? 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            of {leaveSummary?.sil.annualCredits ?? 5}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Reset
                          </p>
                          <p className="mt-2 text-xs text-foreground">
                            Sick:{" "}
                            {leaveSummary
                              ? monthDayLabel(
                                  leaveSummary.sick.resetMonth,
                                  leaveSummary.sick.resetDay,
                                )
                              : "—"}
                          </p>
                          <p className="text-xs text-foreground">
                            SIL:{" "}
                            {leaveSummary
                              ? monthDayLabel(
                                  leaveSummary.sil.resetMonth,
                                  leaveSummary.sil.resetDay,
                                )
                              : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Leave bucket</Label>
                        <Select
                          value={leaveType}
                          onValueChange={(value) => setLeaveType(value as LeaveRequestType)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Paid leave</SelectLabel>
                              {leaveTypeOptions
                                .filter((option) => option !== "UNPAID")
                                .map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {leaveTypeLabel(option)}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel>Other</SelectLabel>
                              <SelectItem value="UNPAID">
                                {leaveTypeLabel("UNPAID")}
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Leave credits are set by the General Manager in Leave Credits. When Sick or SIL credits are zero or insufficient, the system blocks that request and only unpaid leave can be requested.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Reason</Label>
                        <Textarea
                          value={leaveReason}
                          onChange={(event) => setLeaveReason(event.target.value)}
                          rows={5}
                        />
                      </div>

                      {leaveInlineError ? (
                        <p className="text-sm text-destructive">{leaveInlineError}</p>
                      ) : null}
                    </>
                  ) : null}

                  {requestType === "DAY_OFF" ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Source OFF
                          </p>
                          <p className="mt-2 text-sm font-medium">
                            {sourceOffDate ? formatDate(sourceOffDate) : "Pick OFF date"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Target workday
                          </p>
                          <p className="mt-2 text-sm font-medium">
                            {targetWorkDate ? formatDate(targetWorkDate) : "Pick target date"}
                          </p>
                        </div>
                      </div>

                      {dayOffPreview ? (
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                          <p className="font-medium">Preview</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Source: {dayOffPreview.source.shiftLabel}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Target: {dayOffPreview.target.shiftLabel}
                          </p>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <Label>Reason</Label>
                        <Textarea
                          value={dayOffReason}
                          onChange={(event) => setDayOffReason(event.target.value)}
                          rows={5}
                        />
                      </div>
                    </>
                  ) : null}

                  {requestType === "SIL_ENCASHMENT" ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Available SIL
                          </p>
                          <p className="mt-2 text-lg font-semibold">
                            {leaveSummary?.sil.remaining ?? 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            current-year credits
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            After request
                          </p>
                          <p className="mt-2 text-lg font-semibold">
                            {Math.max(
                              0,
                              (leaveSummary?.sil.remaining ?? 0) -
                                (Number(silEncashDays) || 0),
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            if approved
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>SIL days to encash</Label>
                        <Input
                          type="number"
                          min="1"
                          max={leaveSummary?.sil.remaining ?? 0}
                          value={silEncashDays}
                          onChange={(event) => setSilEncashDays(event.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={silEncashRemarks}
                          onChange={(event) => setSilEncashRemarks(event.target.value)}
                          rows={5}
                        />
                      </div>

                      {(Number(silEncashDays) || 0) >
                      (leaveSummary?.sil.remaining ?? 0) ? (
                        <p className="text-sm text-destructive">
                          Only {leaveSummary?.sil.remaining ?? 0} SIL credit(s)
                          available.
                        </p>
                      ) : null}
                    </>
                  ) : null}

                  {requestType === "SCHEDULE_CHANGE" ? (
                    <>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Selected range
                        </p>
                        <p className="mt-2 text-sm font-medium">
                          {scheduleChangeStartDate && scheduleChangeEndDate
                            ? `${formatDateRange(
                                scheduleChangeStartDate,
                                scheduleChangeEndDate,
                              )} · ${
                                countDaysInclusive(
                                  scheduleChangeStartDate,
                                  scheduleChangeEndDate,
                                ) ?? 0
                              } day(s)`
                            : "Pick start and end dates"}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Replacement shift</Label>
                        <Select
                          value={scheduleChangeShiftId}
                          onValueChange={setScheduleChangeShiftId}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pick shift" />
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            <SelectGroup>
                              <SelectLabel>Available shifts</SelectLabel>
                              {organizedScheduleChangeShifts.map((shift) => (
                                <SelectItem key={shift.id} value={String(shift.id)}>
                                  <span className="flex flex-col">
                                    <span className="font-medium">
                                      {shift.code} · {shift.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {shift.shiftLabel}
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedShift ? (
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                          <p className="font-medium">
                            {selectedShift.code} · {selectedShift.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedShift.shiftLabel}
                          </p>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <Label>Reason</Label>
                        <Textarea
                          value={scheduleChangeReason}
                          onChange={(event) => setScheduleChangeReason(event.target.value)}
                          rows={5}
                        />
                      </div>

                      {scheduleChangePreview && selectedShift ? (
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                          <p className="font-medium">Preview</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateRange(
                              scheduleChangePreview.startDate,
                              scheduleChangePreview.endDate,
                            )}{" "}
                            · {scheduleChangePreview.totalDays} day(s)
                          </p>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {requestType === "SCHEDULE_SWAP" ? (
                    <>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Swap date
                        </p>
                        <p className="mt-2 text-sm font-medium">
                          {swapWorkDate ? formatDate(swapWorkDate) : "Pick swap date"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Same-date swap only.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Coworker</Label>
                        <Select value={swapCoworkerId} onValueChange={setSwapCoworkerId}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pick coworker" />
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            <SelectGroup>
                              <SelectLabel>Available coworkers</SelectLabel>
                              {organizedSwapCoworkers.map((coworker) => (
                                <SelectItem
                                  key={coworker.employeeId}
                                  value={coworker.employeeId}
                                >
                                  <span className="flex flex-col">
                                    <span className="font-medium">
                                      {coworker.employeeName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {coworker.employeeCode}
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Reason</Label>
                        <Textarea
                          value={swapReason}
                          onChange={(event) => setSwapReason(event.target.value)}
                          rows={5}
                        />
                      </div>

                      {swapPreview && selectedCoworker ? (
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                          <p className="font-medium">Preview</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Yours: {swapPreview.requester.shiftLabel}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selectedCoworker.employeeName}: {swapPreview.coworker.shiftLabel}
                          </p>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {requestType === "CASH_ADVANCE" ? (
                    <>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                        <p className="font-medium">Payroll note</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Approved requests are deducted one time on the next payroll.
                        </p>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Preferred start
                        </p>
                        <p className="mt-2 font-medium">
                          {cashPreferredStartDate
                            ? formatDate(cashPreferredStartDate)
                            : "Pick bimonthly date"}
                        </p>
                        {cashPreferredStartDate ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {
                              cashAdvanceStartOptions.find(
                                (option) => option.value === cashPreferredStartDate,
                              )?.subtitle
                            }
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={cashAmount}
                          onChange={(event) => setCashAmount(event.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Reason</Label>
                        <Textarea
                          value={cashReason}
                          onChange={(event) => setCashReason(event.target.value)}
                          rows={5}
                        />
                      </div>

                      {cashAmount.trim() ? (
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                          <p className="font-medium">
                            Requested amount: {formatMoney(Number(cashAmount) || 0)}
                          </p>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {requestType === "GOVERNMENT_LOAN" ? (
                    <>
                      <div className="space-y-2">
                        <Label>Loan agency</Label>
                        <div className="grid gap-2">
                          {[
                            {
                              value: GovernmentLoanAgency.SSS_SALARY_LOAN,
                              title: "SSS Salary Loan",
                              subtitle: "Requires saved SSS number.",
                            },
                            {
                              value: GovernmentLoanAgency.PAGIBIG_MPL,
                              title: "Pag-IBIG Multi-Purpose Loan",
                              subtitle: "Requires saved Pag-IBIG MID number.",
                            },
                          ].map((option) => {
                            const active = governmentLoanAgency === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setGovernmentLoanAgency(option.value)}
                                className={cn(
                                  "rounded-xl border p-3 text-left text-sm transition",
                                  active
                                    ? "border-primary/70 bg-primary/18 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.45)]"
                                    : "border-border/70 bg-muted/20 hover:border-primary/40",
                                )}
                              >
                                <span className="font-medium">{option.title}</span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {option.subtitle}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Requested amount</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={governmentLoanAmount}
                          onChange={(event) =>
                            setGovernmentLoanAmount(event.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Payment term</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {([12, 24] as const).map((term) => {
                            const active = governmentLoanTermMonths === term;
                            return (
                              <button
                                key={term}
                                type="button"
                                onClick={() => setGovernmentLoanTermMonths(term)}
                                className={cn(
                                  "rounded-xl border p-3 text-left text-sm transition",
                                  active
                                    ? "border-primary/70 bg-primary/18 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.45)]"
                                    : "border-border/70 bg-muted/20 hover:border-primary/40",
                                )}
                              >
                                <span className="font-medium">{term} months</span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  Monthly repayment term
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Est. monthly
                          </p>
                          <p className="mt-2 text-sm font-medium">
                            {formatMoney(governmentLoanEstimatedMonthly)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Est. per payroll
                          </p>
                          <p className="mt-2 text-sm font-medium">
                            {formatMoney(governmentLoanEstimatedPerPayroll)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                        <p className="font-medium">Workflow</p>
                        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                          Prerequisite complete: saved government ID verified.
                        </p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-2 w-1/4 rounded-full bg-primary" />
                        </div>
                        <ul className="mt-3 grid gap-2 text-xs text-muted-foreground">
                          <li>Request submitted</li>
                          <li>Manager marks processing</li>
                          <li>Agency approved</li>
                          <li>Payroll deduction recorded</li>
                        </ul>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                        Estimates are not final. SSS or Pag-IBIG decides final loanable
                        amount, repayment period, and monthly amortization.
                      </div>

                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={governmentLoanRemarks}
                          onChange={(event) =>
                            setGovernmentLoanRemarks(event.target.value)
                          }
                          rows={4}
                        />
                      </div>
                    </>
                  ) : null}

                  {error ? <p className="text-sm text-destructive">{error}</p> : null}

                  <div className="flex flex-col gap-2 border-t border-border/70 pt-4">
                    <Button
                      disabled={
                        submitting ||
                        !isCalendarSelectionValid ||
                        (requestType === "LEAVE" && Boolean(leaveInlineError)) ||
                        (requestType === "SIL_ENCASHMENT" &&
                          ((Number(silEncashDays) || 0) <= 0 ||
                            (Number(silEncashDays) || 0) >
                              (leaveSummary?.sil.remaining ?? 0))) ||
                        (requestType === "GOVERNMENT_LOAN" &&
                          governmentLoanAmountNumber <= 0)
                      }
                      onClick={() => void submit()}
                    >
                      {submitting ? "Submitting..." : `Submit ${requestTypeLabel(requestType)}`}
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={exitHref}>Cancel</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
