"use client";

import { useEffect, useMemo, useState } from "react";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Calendar as BigCalendar,
  Views,
  dateFnsLocalizer,
  type SlotInfo,
} from "react-big-calendar";
import { CalendarDays, Clock3, Sparkles } from "lucide-react";
import { getEmployeeMonthSchedule } from "@/actions/schedule/schedule-action";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InlineLoadingState,
  ModuleLoadingState,
} from "@/components/loading/loading-states";
import { useSession } from "@/hooks/use-session";
import { TZ } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type EmployeeMonthScheduleDay = {
  date: string;
  shift: {
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
  } | null;
  source: "override" | "pattern" | "none";
  leave: {
    requestId: string | null;
    leaveType: "VACATION" | "SICK" | "PERSONAL" | "EMERGENCY" | "UNPAID";
    isPaidLeave: boolean;
  } | null;
  scheduledStartMinutes: number | null;
  scheduledEndMinutes: number | null;
};

type ScheduleCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: EmployeeMonthScheduleDay;
};

type CalendarEventRendererProps = {
  event: ScheduleCalendarEvent;
};

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 0 }),
  getDay,
  locales,
});

const getNowInTz = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));

const toIsoDate = (date: Date) => {
  const safeDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0),
  );
  return safeDate.toLocaleDateString("en-CA", { timeZone: TZ });
};

const parseIsoDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

const minutesToDate = (baseDate: Date, minutes: number) => {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(minutes);
  return date;
};

const formatMinutes = (minutes: number | null | undefined) => {
  if (minutes == null) return "—";
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
};

const formatLongDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const sourceLabelMap: Record<EmployeeMonthScheduleDay["source"], string> = {
  override: "Manual override",
  pattern: "Pattern schedule",
  none: "No source",
};

const leaveTypeLabelMap: Record<
  NonNullable<EmployeeMonthScheduleDay["leave"]>["leaveType"],
  string
> = {
  VACATION: "Vacation leave",
  SICK: "Sick leave",
  PERSONAL: "Personal leave",
  EMERGENCY: "Emergency leave",
  UNPAID: "Unpaid leave",
};

const EmployeeScedule = () => {
  const { user, employee, loading, error } = useSession();
  const currentMonth = useMemo(() => {
    const now = getNowInTz();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);
  const endOfCurrentMonth = useMemo(
    () =>
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    [currentMonth],
  );
  const currentMonthAnchor = useMemo(
    () => toIsoDate(currentMonth),
    [currentMonth],
  );
  const currentMonthLabel = useMemo(
    () =>
      currentMonth.toLocaleDateString(undefined, {
        timeZone: TZ,
        month: "long",
        year: "numeric",
      }),
    [currentMonth],
  );

  const [selectedDate, setSelectedDate] = useState<Date>(() => getNowInTz());
  const [days, setDays] = useState<EmployeeMonthScheduleDay[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [hasLoadedMonth, setHasLoadedMonth] = useState(false);

  const todayKey = useMemo(() => toIsoDate(getNowInTz()), []);

  useEffect(() => {
    const employeeId = employee?.employeeId;
    if (!employeeId) {
      setDays([]);
      return;
    }

    let mounted = true;
    const load = async () => {
      try {
        setMonthLoading(true);
        setMonthError(null);
        const result = await getEmployeeMonthSchedule({
          employeeId,
          anchorDate: currentMonthAnchor,
        });
        if (!result.success) {
          throw new Error(result.error || "Failed to load schedule");
        }
        if (!mounted) return;
        setDays((result.days ?? []) as EmployeeMonthScheduleDay[]);
      } catch (err) {
        if (!mounted) return;
        setMonthError(
          err instanceof Error ? err.message : "Failed to load schedule",
        );
      } finally {
        if (mounted) {
          setMonthLoading(false);
          setHasLoadedMonth(true);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [employee?.employeeId, currentMonthAnchor]);

  const daysByDate = useMemo(() => {
    const map = new Map<string, EmployeeMonthScheduleDay>();
    days.forEach((day) => {
      map.set(day.date, day);
    });
    return map;
  }, [days]);

  const selectedDateKey = useMemo(
    () => toIsoDate(selectedDate),
    [selectedDate],
  );
  const selectedDay = daysByDate.get(selectedDateKey);
  const todaySchedule = daysByDate.get(todayKey);

  const DaySquareEvent = ({ event }: CalendarEventRendererProps) => {
    const day = event.resource;
    const shift = day.shift;
    const leave = day.leave;

    return (
      <div className="employee-day-event">
        <p className="employee-day-event-code">
          {leave ? "LEAVE" : (shift?.code ?? "REST")}
        </p>
        <p className="employee-day-event-time hidden sm:block">
          {leave
            ? `${leave.isPaidLeave ? "Paid" : "Unpaid"} · ${leaveTypeLabelMap[leave.leaveType]}`
            : !shift
              ? "No shift"
              : `${formatMinutes(day.scheduledStartMinutes)} - ${formatMinutes(
                  day.scheduledEndMinutes,
                )}`}
        </p>
      </div>
    );
  };

  const stats = useMemo(() => {
    const summary = {
      workDays: 0,
      leaveDays: 0,
      paidLeaveDays: 0,
      paidSickLeaveDays: 0,
      restDays: 0,
      overrides: 0,
    };
    days.forEach((day) => {
      if (day.leave) {
        summary.leaveDays += 1;
        if (day.leave.isPaidLeave) {
          if (day.leave.leaveType === "SICK") {
            summary.paidSickLeaveDays += 1;
          } else {
            summary.paidLeaveDays += 1;
          }
        }
      } else if (day.shift) {
        summary.workDays += 1;
      } else {
        summary.restDays += 1;
      }
      if (day.source === "override") {
        summary.overrides += 1;
      }
    });
    return summary;
  }, [days]);

  const calendarEvents = useMemo<ScheduleCalendarEvent[]>(
    () =>
      days.flatMap((day) => {
        const baseDate = parseIsoDate(day.date);
        if (!baseDate) return [];

        if (day.leave) {
          const leaveStart = new Date(baseDate);
          leaveStart.setHours(0, 0, 0, 0);
          const leaveEnd = new Date(leaveStart);
          leaveEnd.setDate(leaveEnd.getDate() + 1);

          return [
            {
              id: `${day.date}-leave`,
              title: `${leaveTypeLabelMap[day.leave.leaveType]} · ${day.leave.isPaidLeave ? "Paid" : "Unpaid"}`,
              start: leaveStart,
              end: leaveEnd,
              allDay: true,
              resource: day,
            },
          ];
        }

        if (
          day.shift &&
          day.scheduledStartMinutes != null &&
          day.scheduledEndMinutes != null
        ) {
          const start = minutesToDate(baseDate, day.scheduledStartMinutes);
          const end = minutesToDate(baseDate, day.scheduledEndMinutes);
          if (
            day.shift.spansMidnight ||
            day.scheduledEndMinutes <= day.scheduledStartMinutes
          ) {
            end.setDate(end.getDate() + 1);
          }
          return [
            {
              id: `${day.date}-${day.shift.id}`,
              title: `${day.shift.code} · ${formatMinutes(day.scheduledStartMinutes)} - ${formatMinutes(day.scheduledEndMinutes)}`,
              start,
              end,
              allDay: true,
              resource: day,
            },
          ];
        }

        const restStart = new Date(baseDate);
        restStart.setHours(0, 0, 0, 0);
        const restEnd = new Date(restStart);
        restEnd.setDate(restEnd.getDate() + 1);
        return [
          {
            id: `${day.date}-rest`,
            title: "Rest day",
            start: restStart,
            end: restEnd,
            allDay: true,
            resource: day,
          },
        ];
      }),
    [days],
  );

  const clampToCurrentMonth = (date: Date) => {
    if (date < currentMonth) return currentMonth;
    if (date > endOfCurrentMonth) return endOfCurrentMonth;
    return date;
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    setSelectedDate(clampToCurrentMonth(slotInfo.start));
  };

  const displayName =
    [employee?.firstName, employee?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    user?.username ||
    "Employee";

  if (loading) {
    return (
      <ModuleLoadingState
        title="Schedule"
        description="Loading your calendar, shift overlays, and schedule details."
      />
    );
  }
  if (error) return <div>Failed to load session</div>;
  if (!user) return <div>No session</div>;
  if (employee?.employeeId && !hasLoadedMonth && !monthError) {
    return (
      <ModuleLoadingState
        title="Schedule"
        description="Loading your calendar, shift overlays, and daily schedule details."
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Employee Schedule
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {currentMonthLabel}
            </h1>
            <p className="text-sm text-muted-foreground">
              Select any date to inspect the shift details for that day.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-3 xl:grid-cols-6 sm:gap-3">
            <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Work
              </p>
              <p className="text-lg font-semibold">{stats.workDays}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Leave
              </p>
              <p className="text-lg font-semibold">{stats.leaveDays}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Paid Leave
              </p>
              <p className="text-lg font-semibold">{stats.paidLeaveDays}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Paid Sick
              </p>
              <p className="text-lg font-semibold">{stats.paidSickLeaveDays}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Rest
              </p>
              <p className="text-lg font-semibold">{stats.restDays}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Override
              </p>
              <p className="text-lg font-semibold">{stats.overrides}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="order-2 min-w-0 border-border/60 bg-card/80 shadow-md backdrop-blur-sm md:order-1">
          <CardHeader className="space-y-2 border-b border-border/60 bg-muted/20">
            <CardTitle className="inline-flex items-center gap-2 text-lg">
              <CalendarDays className="h-4 w-4 text-primary" />
              Schedule Calendar
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Month-only calendar with modern card layout and highlighted
              schedule sources.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="employee-schedule-calendar employee-schedule-calendar--modern h-[620px] w-full overflow-x-auto overflow-y-hidden rounded-2xl border sm:h-[760px] lg:h-[960px]">
              {/* CALENDAR UI */}
              <BigCalendar<ScheduleCalendarEvent>
                localizer={localizer}
                events={calendarEvents}
                date={currentMonth}
                view={Views.MONTH}
                views={[Views.MONTH]}
                drilldownView={Views.MONTH}
                toolbar={false}
                selectable
                popup
                components={{
                  event: DaySquareEvent,
                }}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={(event) =>
                  setSelectedDate(clampToCurrentMonth(event.start))
                }
                // I keep the day background subtle and use it as the quick monthly cue.
                // This lets me explain at a glance whether a date came from the regular pattern,
                // a manual override, or a leave state without competing with the event card itself.
                dayPropGetter={(date) => {
                  const dayKey = toIsoDate(date);
                  const dayInfo = daysByDate.get(dayKey);
                  return {
                    className: cn(
                      dayKey === selectedDateKey && "rbc-selected-day",
                      dayKey === todayKey && "rbc-focus-today",
                      dayInfo?.source === "pattern" &&
                        dayInfo?.shift &&
                        !dayInfo?.leave &&
                        "rbc-pattern-day",
                      dayInfo?.source === "override" &&
                        !dayInfo?.leave &&
                        "rbc-override-day",
                      dayInfo?.leave?.isPaidLeave && "rbc-paid-leave-day",
                      dayInfo?.leave &&
                        !dayInfo.leave.isPaidLeave &&
                        "rbc-unpaid-leave-day",
                    ),
                  };
                }}
                // I reserve the stronger event styling for the main story of the day:
                // shift, leave, or rest. If a day is overridden, I layer that meaning only
                // on shifts so leave still reads as the highest priority state.
                eventPropGetter={(event) => ({
                  className: cn(
                    event.resource.leave
                      ? "rbc-leave-event"
                      : event.resource.shift
                        ? "rbc-shift-event"
                        : "rbc-rest-event",
                    event.resource.leave?.isPaidLeave && "rbc-paid-leave-event",
                    event.resource.source === "override" &&
                      !event.resource.leave &&
                      "rbc-override-event",
                  ),
                })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Selected Date
                </p>
                <p className="mt-1 text-sm font-medium">
                  {selectedDay
                    ? formatLongDate(selectedDay.date)
                    : "No date selected"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedDay?.leave
                    ? `${leaveTypeLabelMap[selectedDay.leave.leaveType]} · ${selectedDay.leave.isPaidLeave ? "Paid" : "Unpaid"}`
                    : selectedDay?.shift
                      ? `${selectedDay.shift.name} · ${formatMinutes(
                          selectedDay.scheduledStartMinutes,
                        )} - ${formatMinutes(selectedDay.scheduledEndMinutes)}`
                      : "No shift scheduled"}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Legend
                </p>
                <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <p>
                    <span className="employee-schedule-legend-dot employee-schedule-legend-dot--pattern" />
                    Pattern shift
                  </p>
                  <p>
                    <span className="employee-schedule-legend-dot employee-schedule-legend-dot--override" />
                    Manual override
                  </p>
                  <p>
                    <span className="employee-schedule-legend-dot employee-schedule-legend-dot--paid-leave" />
                    Paid leave
                  </p>
                  <p>
                    <span className="employee-schedule-legend-dot employee-schedule-legend-dot--unpaid-leave" />
                    Unpaid leave
                  </p>
                  <p>
                    <span className="employee-schedule-legend-dot employee-schedule-legend-dot--rest" />
                    Rest day
                  </p>
                </div>
              </div>
            </div>

            {monthLoading && (
              <InlineLoadingState
                label="Loading month schedule"
                lines={2}
                className="border-border/60 bg-muted/10"
              />
            )}
            {monthError && (
              <p className="text-sm text-destructive">{monthError}</p>
            )}
          </CardContent>
        </Card>

        <div className="order-1 space-y-6 md:order-2">
          <Card className="border-border/60 bg-card shadow-md">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-lg">
                <Clock3 className="h-4 w-4 text-primary" />
                Today&apos;s Schedule
              </CardTitle>
              <p className="text-sm text-muted-foreground">{displayName}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {monthLoading ? (
                <InlineLoadingState
                  label="Loading today's schedule"
                  lines={2}
                  className="border-border/60 bg-muted/10"
                />
              ) : monthError ? (
                <p className="text-sm text-destructive">{monthError}</p>
              ) : todaySchedule?.leave ? (
                <>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {formatLongDate(todaySchedule.date)}
                    </p>
                    <p className="text-xl font-semibold">
                      {leaveTypeLabelMap[todaySchedule.leave.leaveType]}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {todaySchedule.leave.isPaidLeave
                        ? "Paid leave"
                        : "Unpaid leave"}
                      {todaySchedule.shift
                        ? ` · Scheduled ${formatMinutes(
                            todaySchedule.scheduledStartMinutes,
                          )} - ${formatMinutes(todaySchedule.scheduledEndMinutes)}`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      // I keep this badge in the same color family as the leave event
                      // so the side panel reinforces the meaning already established in the calendar.
                      "employee-schedule-status-badge",
                      todaySchedule.leave.isPaidLeave
                        ? "employee-schedule-status-badge--paid-leave"
                        : "employee-schedule-status-badge--unpaid-leave",
                    )}
                  >
                    {todaySchedule.leave.isPaidLeave
                      ? "Paid leave"
                      : "Unpaid leave"}
                  </Badge>
                </>
              ) : !todaySchedule?.shift ? (
                <p className="text-sm text-muted-foreground">
                  No shift scheduled for today.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {formatLongDate(todaySchedule.date)}
                    </p>
                    <p className="text-xl font-semibold">
                      {todaySchedule.shift.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatMinutes(todaySchedule.scheduledStartMinutes)} -{" "}
                      {formatMinutes(todaySchedule.scheduledEndMinutes)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      // I treat this as a source badge, so I color it by where the schedule
                      // came from: regular pattern, manual override, or no assigned shift.
                      "employee-schedule-status-badge",
                      todaySchedule.source === "pattern" &&
                        "employee-schedule-status-badge--pattern",
                      todaySchedule.source === "override" &&
                        "employee-schedule-status-badge--override",
                      todaySchedule.source === "none" &&
                        "employee-schedule-status-badge--rest",
                    )}
                  >
                    {sourceLabelMap[todaySchedule.source]}
                  </Badge>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmployeeScedule;
