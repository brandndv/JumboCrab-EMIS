"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LeaveRequestType } from "@prisma/client";
import {
  createCashAdvanceRequest,
  createDayOffRequest,
  createLeaveRequest,
  getDayOffPreview,
  getScheduleChangePreview,
  createScheduleChangeRequest,
  createScheduleSwapRequest,
  listScheduleChangeShifts,
  getScheduleSwapPreview,
  listEmployeesForScheduleSwap,
  type DayOffPreview,
  type ScheduleChangePreview,
  type ScheduleChangeShiftOption,
  type ScheduleSwapEmployeeOption,
  type ScheduleSwapPreview,
} from "@/actions/requests/requests-action";
import {
  countDaysInclusive,
  formatDateRange,
  formatMoney,
  leaveTypeLabel,
  requestTypeLabel,
} from "@/features/manage-requests/request-ui-helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RequestType =
  | "CASH_ADVANCE"
  | "DAY_OFF"
  | "LEAVE"
  | "SCHEDULE_CHANGE"
  | "SCHEDULE_SWAP";

type RequestFormPageProps = {
  lockedRequestType?: RequestType;
};

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const leaveTypeOptions: LeaveRequestType[] = [
  "VACATION",
  "SICK",
  "PERSONAL",
  "EMERGENCY",
  "UNPAID",
];

export default function CashAdvanceRequestFormPage({
  lockedRequestType,
}: RequestFormPageProps) {
  const router = useRouter();
  const requestTypeOptions = lockedRequestType
    ? [lockedRequestType]
    : ([
        "CASH_ADVANCE",
        "DAY_OFF",
        "LEAVE",
        "SCHEDULE_CHANGE",
        "SCHEDULE_SWAP",
      ] as const);
  const [requestType, setRequestType] = useState<RequestType>(
    lockedRequestType ?? "CASH_ADVANCE",
  );

  const [amount, setAmount] = useState("");
  const [repaymentPerPayroll, setRepaymentPerPayroll] = useState("");
  const [preferredStartDate, setPreferredStartDate] = useState(
    toDateInputValue(new Date()),
  );
  const [cashReason, setCashReason] = useState("");

  const [leaveType, setLeaveType] = useState<LeaveRequestType>("VACATION");
  const [leaveStartDate, setLeaveStartDate] = useState(
    toDateInputValue(new Date()),
  );
  const [leaveEndDate, setLeaveEndDate] = useState(toDateInputValue(new Date()));
  const [leaveReason, setLeaveReason] = useState("");

  const [dayOffWorkDate, setDayOffWorkDate] = useState(toDateInputValue(new Date()));
  const [dayOffPreview, setDayOffPreview] = useState<DayOffPreview | null>(null);
  const [dayOffReason, setDayOffReason] = useState("");
  const [dayOffLoading, setDayOffLoading] = useState(false);

  const [scheduleChangeWorkDate, setScheduleChangeWorkDate] = useState(
    toDateInputValue(new Date()),
  );
  const [scheduleChangeShifts, setScheduleChangeShifts] = useState<
    ScheduleChangeShiftOption[]
  >([]);
  const [scheduleChangeShiftQuery, setScheduleChangeShiftQuery] = useState("");
  const [scheduleChangeShiftId, setScheduleChangeShiftId] = useState("");
  const [scheduleChangeDropdownOpen, setScheduleChangeDropdownOpen] =
    useState(false);
  const [scheduleChangePreview, setScheduleChangePreview] =
    useState<ScheduleChangePreview | null>(null);
  const [scheduleChangeReason, setScheduleChangeReason] = useState("");
  const [scheduleChangeLoading, setScheduleChangeLoading] = useState(false);

  const [swapWorkDate, setSwapWorkDate] = useState(toDateInputValue(new Date()));
  const [swapCoworkers, setSwapCoworkers] = useState<ScheduleSwapEmployeeOption[]>(
    [],
  );
  const [swapCoworkerQuery, setSwapCoworkerQuery] = useState("");
  const [swapCoworkerId, setSwapCoworkerId] = useState("");
  const [swapCoworkerDropdownOpen, setSwapCoworkerDropdownOpen] = useState(false);
  const [swapPreview, setSwapPreview] = useState<ScheduleSwapPreview | null>(null);
  const [swapReason, setSwapReason] = useState("");
  const [swapLoading, setSwapLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLeaveOnly = lockedRequestType === "LEAVE";
  const exitHref = isLeaveOnly ? "/employee/requests/leave" : "/employee/requests";
  const pageTitle = isLeaveOnly ? "New Leave Request" : "New Request";
  const pageDescription = isLeaveOnly
    ? "Submit a leave request and track its status from the Requests module."
    : "Submit a request for manager approval. Cash advance, day off, leave, schedule change, and schedule swap are currently available request types.";

  const amountValue = Number(amount);
  const repaymentValue = Number(repaymentPerPayroll);
  const estimatedPayrolls =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    Number.isFinite(repaymentValue) &&
    repaymentValue > 0
      ? Math.ceil(amountValue / repaymentValue)
      : null;

  const leaveDays = countDaysInclusive(leaveStartDate, leaveEndDate);
  const selectedSwapCoworker = useMemo(
    () =>
      swapCoworkers.find((coworker) => coworker.employeeId === swapCoworkerId) ??
      null,
    [swapCoworkerId, swapCoworkers],
  );
  const selectedScheduleChangeShift = useMemo(
    () =>
      scheduleChangeShifts.find(
        (shift) => String(shift.id) === scheduleChangeShiftId,
      ) ?? null,
    [scheduleChangeShiftId, scheduleChangeShifts],
  );

  const loadScheduleChangeShifts = useCallback(async (query: string) => {
    try {
      setScheduleChangeLoading(true);
      const result = await listScheduleChangeShifts({
        query,
        limit: 50,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to load shifts");
      }
      setScheduleChangeShifts(result.data ?? []);
    } catch (err) {
      setScheduleChangeShifts([]);
      setError(err instanceof Error ? err.message : "Failed to load shifts");
    } finally {
      setScheduleChangeLoading(false);
    }
  }, []);

  const loadSwapCoworkers = useCallback(async (query: string) => {
    try {
      setSwapLoading(true);
      const result = await listEmployeesForScheduleSwap({
        query,
        limit: 50,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to load coworkers");
      }
      setSwapCoworkers(result.data ?? []);
    } catch (err) {
      setSwapCoworkers([]);
      setError(err instanceof Error ? err.message : "Failed to load coworkers");
    } finally {
      setSwapLoading(false);
    }
  }, []);

  useEffect(() => {
    if (requestType !== "DAY_OFF" || !dayOffWorkDate) {
      setDayOffPreview(null);
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      try {
        setDayOffLoading(true);
        const result = await getDayOffPreview({
          workDate: dayOffWorkDate,
        });
        if (cancelled) return;
        if (!result.success) {
          setDayOffPreview(null);
          setError(result.error || "Failed to load day off preview");
          return;
        }
        setError(null);
        setDayOffPreview(result.data ?? null);
      } finally {
        if (!cancelled) {
          setDayOffLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [dayOffWorkDate, requestType]);

  useEffect(() => {
    if (requestType !== "SCHEDULE_CHANGE") return;
    void loadScheduleChangeShifts(scheduleChangeShiftQuery);
  }, [loadScheduleChangeShifts, requestType, scheduleChangeShiftQuery]);

  useEffect(() => {
    if (
      requestType !== "SCHEDULE_CHANGE" ||
      !scheduleChangeShiftId ||
      !scheduleChangeWorkDate
    ) {
      setScheduleChangePreview(null);
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      try {
        setScheduleChangeLoading(true);
        const result = await getScheduleChangePreview({
          requestedShiftId: scheduleChangeShiftId,
          workDate: scheduleChangeWorkDate,
        });
        if (cancelled) return;
        if (!result.success) {
          setScheduleChangePreview(null);
          setError(result.error || "Failed to load schedule change preview");
          return;
        }
        setError(null);
        setScheduleChangePreview(result.data ?? null);
      } finally {
        if (!cancelled) {
          setScheduleChangeLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [requestType, scheduleChangeShiftId, scheduleChangeWorkDate]);

  useEffect(() => {
    if (requestType !== "SCHEDULE_SWAP") return;
    void loadSwapCoworkers(swapCoworkerQuery);
  }, [loadSwapCoworkers, requestType, swapCoworkerQuery]);

  useEffect(() => {
    if (requestType !== "SCHEDULE_SWAP" || !swapCoworkerId || !swapWorkDate) {
      setSwapPreview(null);
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      try {
        setSwapLoading(true);
        const result = await getScheduleSwapPreview({
          coworkerEmployeeId: swapCoworkerId,
          workDate: swapWorkDate,
        });
        if (cancelled) return;
        if (!result.success) {
          setSwapPreview(null);
          setError(result.error || "Failed to load swap preview");
          return;
        }
        setError(null);
        setSwapPreview(result.data ?? null);
      } finally {
        if (!cancelled) {
          setSwapLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [requestType, swapCoworkerId, swapWorkDate]);

  const previewRows = useMemo(() => {
    if (requestType === "LEAVE") {
      return [
        {
          label: "Leave Type",
          value: leaveTypeLabel(leaveType),
        },
        {
          label: "Leave Period",
          value: formatDateRange(leaveStartDate, leaveEndDate),
        },
        {
          label: "Total Days",
          value:
            leaveDays == null
              ? "Check dates"
              : `${leaveDays} day${leaveDays === 1 ? "" : "s"}`,
        },
      ];
    }

    if (requestType === "DAY_OFF") {
      return [
        {
          label: "Day Off Date",
          value: formatDateRange(dayOffWorkDate, dayOffWorkDate),
        },
        {
          label: "Current Schedule",
          value: dayOffPreview?.current.shiftLabel ?? "Checking schedule",
        },
        {
          label: "Request Status",
          value: dayOffPreview
            ? dayOffPreview.wouldChange
              ? "Ready to submit"
              : "Already day off"
            : "Check preview",
        },
      ];
    }

    if (requestType === "SCHEDULE_CHANGE") {
      return [
        {
          label: "Change Date",
          value: formatDateRange(scheduleChangeWorkDate, scheduleChangeWorkDate),
        },
        {
          label: "Requested Shift",
          value: selectedScheduleChangeShift
            ? selectedScheduleChangeShift.name
            : "Select requested shift",
        },
        {
          label: "Request Status",
          value: scheduleChangePreview
            ? "Ready to submit"
            : scheduleChangeShiftId
              ? "Check preview"
              : "Choose a shift",
        },
      ];
    }

    if (requestType === "SCHEDULE_SWAP") {
      return [
        {
          label: "Swap Date",
          value: formatDateRange(swapWorkDate, swapWorkDate),
        },
        {
          label: "Coworker",
          value: selectedSwapCoworker
            ? `${selectedSwapCoworker.employeeCode} · ${selectedSwapCoworker.employeeName}`
            : "Select coworker",
        },
        {
          label: "Swap Status",
          value: swapPreview
            ? "Ready to submit"
            : swapCoworkerId
              ? "Check preview"
              : "Choose a coworker",
        },
      ];
    }

    return [
      {
        label: "Requested Amount",
        value:
          Number.isFinite(amountValue) && amountValue > 0
            ? formatMoney(amountValue)
            : "Enter amount",
      },
      {
        label: "Per Payroll",
        value:
          Number.isFinite(repaymentValue) && repaymentValue > 0
            ? formatMoney(repaymentValue)
            : "Enter repayment",
      },
      {
        label: "Estimated Payrolls",
        value: estimatedPayrolls ? String(estimatedPayrolls) : "Not ready",
      },
    ];
  }, [
    amountValue,
    dayOffPreview,
    dayOffWorkDate,
    estimatedPayrolls,
    leaveDays,
    leaveEndDate,
    leaveStartDate,
    leaveType,
    requestType,
    repaymentValue,
    scheduleChangePreview,
    scheduleChangeShiftId,
    scheduleChangeWorkDate,
    selectedScheduleChangeShift,
    selectedSwapCoworker,
    swapCoworkerId,
    swapPreview,
    swapWorkDate,
  ]);

  const handleSubmit = async () => {
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
          : requestType === "DAY_OFF"
            ? await createDayOffRequest({
                workDate: dayOffWorkDate,
                reason: dayOffReason,
              })
          : requestType === "SCHEDULE_CHANGE"
            ? await createScheduleChangeRequest({
                workDate: scheduleChangeWorkDate,
                requestedShiftId: scheduleChangeShiftId,
                reason: scheduleChangeReason,
              })
          : requestType === "SCHEDULE_SWAP"
            ? await createScheduleSwapRequest({
                coworkerEmployeeId: swapCoworkerId,
                workDate: swapWorkDate,
                reason: swapReason,
              })
            : await createCashAdvanceRequest({
                amount,
                repaymentPerPayroll,
                preferredStartDate,
                reason: cashReason,
              });

      if (!result.success) {
        throw new Error(result.error || "Failed to submit request");
      }

      router.push(exitHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled =
    submitting ||
    (requestType === "DAY_OFF" &&
      (!dayOffPreview || !dayOffPreview.wouldChange)) ||
    (requestType === "SCHEDULE_CHANGE" &&
      (!scheduleChangeShiftId || !scheduleChangePreview)) ||
    (requestType === "SCHEDULE_SWAP" && (!swapCoworkerId || !swapPreview));

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{pageDescription}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,24rem)]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Request Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {lockedRequestType ? (
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Request Type
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {requestTypeLabel(lockedRequestType)}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="request-type">Request Type</Label>
                <Select
                  value={requestType}
                  onValueChange={(value) => setRequestType(value as RequestType)}
                >
                  <SelectTrigger id="request-type">
                    <SelectValue placeholder="Select request type" />
                  </SelectTrigger>
                  <SelectContent>
                    {requestTypeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {requestTypeLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {requestType === "LEAVE" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="leave-type">Leave Type</Label>
                  <Select
                    value={leaveType}
                    onValueChange={(value) => setLeaveType(value as LeaveRequestType)}
                  >
                    <SelectTrigger id="leave-type">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypeOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {leaveTypeLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="leave-start-date">Start Date</Label>
                    <Input
                      id="leave-start-date"
                      type="date"
                      value={leaveStartDate}
                      onChange={(event) => setLeaveStartDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="leave-end-date">End Date</Label>
                    <Input
                      id="leave-end-date"
                      type="date"
                      value={leaveEndDate}
                      onChange={(event) => setLeaveEndDate(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leave-reason">Reason</Label>
                  <textarea
                    id="leave-reason"
                    value={leaveReason}
                    onChange={(event) => setLeaveReason(event.target.value)}
                    placeholder="Why are you requesting this leave?"
                    className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </>
            ) : requestType === "DAY_OFF" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="day-off-date">Day Off Date</Label>
                  <Input
                    id="day-off-date"
                    type="date"
                    value={dayOffWorkDate}
                    onChange={(event) => setDayOffWorkDate(event.target.value)}
                  />
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Day Off Preview</p>
                      <p className="text-sm text-muted-foreground">
                        Review your current schedule for that date before sending
                        the request for manager approval.
                      </p>
                    </div>
                    {dayOffPreview?.wouldChange ? (
                      <p className="text-sm font-medium text-emerald-600">
                        Ready for manager review
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {dayOffLoading ? "Loading preview" : "Already day off"}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-background p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Current Schedule
                      </p>
                      <p className="mt-2 text-base font-semibold">
                        {dayOffPreview?.current.shiftLabel ?? "Checking schedule"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Result After Approval
                      </p>
                      <p className="mt-2 text-base font-semibold">Day off</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="day-off-reason">Reason</Label>
                  <textarea
                    id="day-off-reason"
                    value={dayOffReason}
                    onChange={(event) => setDayOffReason(event.target.value)}
                    placeholder="Why are you requesting a day off?"
                    className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </>
            ) : requestType === "SCHEDULE_CHANGE" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-change-date">Change Date</Label>
                    <Input
                      id="schedule-change-date"
                      type="date"
                      value={scheduleChangeWorkDate}
                      onChange={(event) =>
                        setScheduleChangeWorkDate(event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-change-shift-search">
                      Requested Shift
                    </Label>
                    <div className="relative">
                      <Input
                        id="schedule-change-shift-search"
                        value={scheduleChangeShiftQuery}
                        onChange={(event) => {
                          setScheduleChangeShiftQuery(event.target.value);
                          setScheduleChangeDropdownOpen(true);
                          if (!event.target.value.trim()) {
                            setScheduleChangeShiftId("");
                            setScheduleChangePreview(null);
                          }
                        }}
                        onFocus={() => setScheduleChangeDropdownOpen(true)}
                        placeholder={
                          scheduleChangeLoading ? "Loading shifts..." : "Search shift"
                        }
                      />
                      {scheduleChangeDropdownOpen &&
                      (scheduleChangeShiftQuery.trim() ||
                        scheduleChangeShifts.length > 0) ? (
                        <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-border/70 bg-background shadow-lg">
                          {scheduleChangeShifts.length > 0 ? (
                            scheduleChangeShifts.map((shift) => (
                              <button
                                key={shift.id}
                                type="button"
                                className="flex w-full flex-col items-start gap-1 px-3 py-3 text-left hover:bg-muted/40"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setScheduleChangeShiftId(String(shift.id));
                                  setScheduleChangeShiftQuery(shift.name);
                                  setScheduleChangeDropdownOpen(false);
                                }}
                              >
                                <span className="font-medium">{shift.name}</span>
                                <span className="text-sm text-muted-foreground">
                                  {shift.shiftLabel}
                                </span>
                              </button>
                            ))
                          ) : (
                            <p className="px-3 py-3 text-sm text-muted-foreground">
                              No shifts found.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Schedule Change Preview</p>
                      <p className="text-sm text-muted-foreground">
                        Compare your current schedule with the shift you want to
                        request before sending it for manager review.
                      </p>
                    </div>
                    {scheduleChangePreview ? (
                      <p className="text-sm font-medium text-emerald-600">
                        Ready for manager review
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Preview pending
                      </p>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-background p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Current Schedule
                      </p>
                      <p className="mt-2 text-base font-semibold">
                        {scheduleChangePreview?.current.shiftLabel ??
                          "Choose requested shift"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Requested Schedule
                      </p>
                      <p className="mt-2 text-base font-semibold">
                        {scheduleChangePreview?.requested.shiftLabel ??
                          "Waiting for preview"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule-change-reason">Reason</Label>
                  <textarea
                    id="schedule-change-reason"
                    value={scheduleChangeReason}
                    onChange={(event) => setScheduleChangeReason(event.target.value)}
                    placeholder="Why are you requesting this schedule change?"
                    className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </>
            ) : requestType === "SCHEDULE_SWAP" ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="swap-work-date">Swap Date</Label>
                    <Input
                      id="swap-work-date"
                      type="date"
                      value={swapWorkDate}
                      onChange={(event) => setSwapWorkDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="swap-coworker-search">Coworker</Label>
                    <div className="relative">
                      <Input
                        id="swap-coworker-search"
                        value={swapCoworkerQuery}
                        onChange={(event) => {
                          setSwapCoworkerQuery(event.target.value);
                          setSwapCoworkerDropdownOpen(true);
                          if (!event.target.value.trim()) {
                            setSwapCoworkerId("");
                            setSwapPreview(null);
                          }
                        }}
                        onFocus={() => setSwapCoworkerDropdownOpen(true)}
                        placeholder={
                          swapLoading ? "Loading coworkers..." : "Search coworker"
                        }
                      />
                      {swapCoworkerDropdownOpen &&
                      (swapCoworkerQuery.trim() || swapCoworkers.length > 0) ? (
                        <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-border/70 bg-background shadow-lg">
                          {swapCoworkers.length > 0 ? (
                            swapCoworkers.map((coworker) => (
                              <button
                                key={coworker.employeeId}
                                type="button"
                                className="flex w-full flex-col items-start gap-1 px-3 py-3 text-left hover:bg-muted/40"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setSwapCoworkerId(coworker.employeeId);
                                  setSwapCoworkerQuery(
                                    `${coworker.employeeCode} · ${coworker.employeeName}`,
                                  );
                                  setSwapCoworkerDropdownOpen(false);
                                }}
                              >
                                <span className="font-medium">
                                  {coworker.employeeName}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {coworker.employeeCode}
                                </span>
                              </button>
                            ))
                          ) : (
                            <p className="px-3 py-3 text-sm text-muted-foreground">
                              No coworkers found.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Swap Preview</p>
                      <p className="text-sm text-muted-foreground">
                        Pick a date and coworker to preview both schedules before
                        you submit the request.
                      </p>
                    </div>
                    {swapPreview ? (
                      <p className="text-sm font-medium text-emerald-600">
                        Ready for coworker review
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Preview pending
                      </p>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-background p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Your Current Schedule
                      </p>
                      <p className="mt-2 text-base font-semibold">
                        {swapPreview?.requester.shiftLabel ?? "Choose coworker"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Coworker Current Schedule
                      </p>
                      <p className="mt-2 text-base font-semibold">
                        {swapPreview?.coworker.shiftLabel ?? "Waiting for preview"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="swap-reason">Reason</Label>
                  <textarea
                    id="swap-reason"
                    value={swapReason}
                    onChange={(event) => setSwapReason(event.target.value)}
                    placeholder="Why are you requesting this schedule swap?"
                    className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cash-advance-amount">Requested Amount</Label>
                    <Input
                      id="cash-advance-amount"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cash-advance-repayment">
                      Repayment Per Payroll
                    </Label>
                    <Input
                      id="cash-advance-repayment"
                      inputMode="decimal"
                      value={repaymentPerPayroll}
                      onChange={(event) => setRepaymentPerPayroll(event.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cash-advance-start-date">
                    Preferred Start Date
                  </Label>
                  <Input
                    id="cash-advance-start-date"
                    type="date"
                    value={preferredStartDate}
                    onChange={(event) => setPreferredStartDate(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    This becomes the deduction start date if your request is
                    approved.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cash-advance-reason">Reason</Label>
                  <textarea
                    id="cash-advance-reason"
                    value={cashReason}
                    onChange={(event) => setCashReason(event.target.value)}
                    placeholder="Why are you requesting this cash advance?"
                    className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </>
            )}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(exitHref)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitDisabled}
              >
                Submit Request
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Request Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Active Request Type
              </p>
              <p className="mt-2 text-lg font-semibold">
                {requestTypeLabel(requestType)}
              </p>
            </div>

            {previewRows.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 text-lg font-semibold">{item.value}</p>
              </div>
            ))}

            {requestType === "DAY_OFF" ? (
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  After Approval
                </p>
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-border/60 bg-background p-3">
                    <p className="text-sm text-muted-foreground">
                      Current schedule
                    </p>
                    <p className="mt-1 font-semibold">
                      {dayOffPreview?.current.shiftLabel ?? "Checking schedule"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background p-3">
                    <p className="text-sm text-muted-foreground">
                      Approved result
                    </p>
                    <p className="mt-1 font-semibold">Day off</p>
                  </div>
                </div>
              </div>
            ) : requestType === "SCHEDULE_CHANGE" ? (
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  After Approval
                </p>
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-border/60 bg-background p-3">
                    <p className="text-sm text-muted-foreground">
                      Current schedule
                    </p>
                    <p className="mt-1 font-semibold">
                      {scheduleChangePreview?.current.shiftLabel ??
                        "Waiting for preview"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background p-3">
                    <p className="text-sm text-muted-foreground">
                      Requested schedule
                    </p>
                    <p className="mt-1 font-semibold">
                      {scheduleChangePreview?.requested.shiftLabel ??
                        "Waiting for preview"}
                    </p>
                  </div>
                </div>
              </div>
            ) : requestType === "SCHEDULE_SWAP" ? (
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  After Approval
                </p>
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-border/60 bg-background p-3">
                    <p className="text-sm text-muted-foreground">Your new schedule</p>
                    <p className="mt-1 font-semibold">
                      {swapPreview?.coworker.shiftLabel ?? "Waiting for preview"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background p-3">
                    <p className="text-sm text-muted-foreground">
                      Coworker&apos;s new schedule
                    </p>
                    <p className="mt-1 font-semibold">
                      {swapPreview?.requester.shiftLabel ?? "Waiting for preview"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-dashed border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
              {requestType === "LEAVE"
                ? "Approved leave requests are recorded in your request history for manager review tracking."
                : requestType === "DAY_OFF"
                  ? "Manager approval clears the scheduled shift for that date and applies a one-day rest-day override."
                : requestType === "SCHEDULE_CHANGE"
                  ? "Manager approval applies the requested one-day schedule override and updates the day schedule snapshot if attendance already exists."
                : requestType === "SCHEDULE_SWAP"
                  ? "Your coworker must accept the swap before it reaches the manager review queue. Manager approval then applies both day overrides."
                  : "Manager approval creates the linked cash advance deduction automatically. Payroll deductions begin from the approved start date."}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
