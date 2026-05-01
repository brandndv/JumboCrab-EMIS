"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TZ } from "@/lib/timezone";
import {
  listAttendance,
  listAttendancePunches,
  recomputeAttendanceForDate,
} from "@/actions/attendance/attendance-action";
import type {
  AttendanceLiveEvent,
  AttendanceLivePunch,
  AttendanceLiveRow,
} from "@/lib/attendance-live/types";

export type AttendanceRow = {
  id: string;
  workDate: string;
  status: string;
  scheduledStartMinutes?: number | null;
  scheduledEndMinutes?: number | null;
  scheduledBreakMinutes?: number | null;
  actualInAt?: string | null;
  actualOutAt?: string | null;
  forgotToTimeOut?: boolean;
  breakStartAt?: string | null;
  breakEndAt?: string | null;
  lateMinutes?: number | null;
  undertimeMinutes?: number | null;
  overtimeMinutesRaw?: number | null;
  workedMinutes?: number | null;
  workedHoursAndMinutes?: string | null;
  dailyRate?: number | null;
  ratePerMinute?: number | null;
  payableAmount?: number | null;
  deductedBreakMinutes?: number | null;
  netWorkedMinutes?: number | null;
  netWorkedHoursAndMinutes?: string | null;
  payableWorkedMinutes?: number | null;
  payableWorkedHoursAndMinutes?: string | null;
  lateGraceCreditMinutes?: number | null;
  breakMinutes?: number | null;
  breakCount?: number | null;
  punchesCount?: number | null;
  expectedShiftName?: string | null;
  employeeId: string;
  employee?: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null } | null;
    position?: { name: string | null } | null;
  } | null;
};

export type PunchRow = {
  id: string;
  punchType: string;
  punchTime: string;
  employee: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null } | null;
    position?: { name: string | null } | null;
  } | null;
};

const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

const toDateKey = (value: string) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });

const mergeAttendanceRow = (
  current: AttendanceRow[],
  incoming: AttendanceLiveRow | null,
) => {
  if (!incoming) return current;

  const key = `${incoming.employeeId}:${toDateKey(incoming.workDate)}`;
  const next = [...current];
  const index = next.findIndex(
    (row) => `${row.employeeId}:${toDateKey(row.workDate)}` === key,
  );

  if (index >= 0) {
    next[index] = incoming;
    return next;
  }

  next.push(incoming);
  next.sort((left, right) => {
    if (left.workDate === right.workDate) {
      return `${left.employee?.lastName ?? ""}${left.employee?.firstName ?? ""}`.localeCompare(
        `${right.employee?.lastName ?? ""}${right.employee?.firstName ?? ""}`,
      );
    }
    return right.workDate.localeCompare(left.workDate);
  });
  return next;
};

const mergePunch = (
  current: PunchRow[],
  incoming: AttendanceLivePunch | null,
  deletedPunchId?: string | null,
) => {
  let next = current;

  if (deletedPunchId) {
    next = next.filter((row) => row.id !== deletedPunchId);
  }

  if (!incoming) {
    return next;
  }

  const withoutExisting = next.filter((row) => row.id !== incoming.id);
  return [...withoutExisting, incoming].sort(
    (left, right) =>
      new Date(left.punchTime).getTime() - new Date(right.punchTime).getTime(),
  );
};

export function useAttendanceState(
  initialDate = todayISO(),
  options?: { supervisorUserId?: string | null },
) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [date, setDate] = useState(initialDate);
  const [punches, setPunches] = useState<PunchRow[]>([]);
  const [recomputeLoading, setRecomputeLoading] = useState(false);
  const [recomputeMessage, setRecomputeMessage] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const streamRef = useRef<EventSource | null>(null);
  const supervisorUserId = options?.supervisorUserId?.trim() || undefined;

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);

    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      setPunchError(null);
      if (!silent) {
        setRecomputeMessage(null);
      }
      const [attendanceResult, punchesResult] = await Promise.all([
        listAttendance({
          start: date,
          end: date,
          includeAll: true,
          supervisorUserId,
        }),
        listAttendancePunches({ start: date, supervisorUserId }),
      ]);
      if (!attendanceResult.success) {
        throw new Error(attendanceResult.error || "Failed to load attendance");
      }
      if (!punchesResult.success) {
        throw new Error(punchesResult.error || "Failed to load punches");
      }
      setRows(attendanceResult.data ?? []);
      setPunches(punchesResult.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load attendance",
      );
      setPunchError(
        err instanceof Error ? err.message : "Failed to load punches",
      );
      setPunches([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [date, supervisorUserId]);

  const recomputeDay = useCallback(async () => {
    try {
      setRecomputeLoading(true);
      setRecomputeMessage(null);
      const result = await recomputeAttendanceForDate({ date });
      if (!result.success) {
        throw new Error(result.error || "Failed to recompute attendance");
      }
      setRecomputeMessage(
        `Recomputed ${result.data?.processedCount ?? 0} employee(s) for ${date}.`,
      );
      await load();
    } catch (err) {
      setRecomputeMessage(
        err instanceof Error ? err.message : "Failed to recompute attendance",
      );
    } finally {
      setRecomputeLoading(false);
    }
  }, [date, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let disposed = false;

    const clearReconnect = () => {
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      clearReconnect();
      const source = new EventSource(
        `/api/attendance/stream?date=${encodeURIComponent(date)}`,
      );
      streamRef.current = source;

      source.addEventListener("open", () => {
        setConnected(true);
        void load({ silent: true });
      });

      source.addEventListener("attendance-update", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as AttendanceLiveEvent;
        setRows((current) => mergeAttendanceRow(current, payload.attendance));
        setPunches((current) =>
          mergePunch(current, payload.punch, payload.deletedPunchId),
        );
      });

      source.addEventListener("error", () => {
        setConnected(false);
        source.close();
        if (!disposed) {
          reconnectTimerRef.current = window.setTimeout(connect, 3_000);
        }
      });
    };

    connect();

    return () => {
      disposed = true;
      setConnected(false);
      clearReconnect();
      streamRef.current?.close();
      streamRef.current = null;
    };
  }, [date, load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void load({ silent: true });
    }, connected ? 15_000 : 10_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [connected, load]);

  return {
    rows,
    loading,
    error,
    punchError,
    date,
    punches,
    connected,
    recomputeLoading,
    recomputeMessage,
    setDate,
    setPunchError,
    load,
    recomputeDay,
  };
}
