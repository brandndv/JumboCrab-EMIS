"use client";

import { useEffect, useState } from "react";
import { TZ } from "@/lib/timezone";
import {
  autoLockAttendance,
  listAttendance,
  listAttendancePunches,
} from "@/actions/attendance/attendance-action";

export type AttendanceRow = {
  id: string;
  workDate: string;
  status: string;
  scheduledStartMinutes?: number | null;
  scheduledEndMinutes?: number | null;
  actualInAt?: string | null;
  actualOutAt?: string | null;
  lateMinutes?: number | null;
  undertimeMinutes?: number | null;
  overtimeMinutesRaw?: number | null;
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

export function useAttendanceState(initialDate = todayISO()) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [date, setDate] = useState(initialDate);
  const [punches, setPunches] = useState<PunchRow[]>([]);
  const [lockLoading, setLockLoading] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setPunchError(null);
      setLockMessage(null);
      const [attendanceResult, punchesResult] = await Promise.all([
        listAttendance({ start: date, end: date, includeAll: true }),
        listAttendancePunches({ start: date }),
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
      setError(err instanceof Error ? err.message : "Failed to load attendance");
      setPunchError(err instanceof Error ? err.message : "Failed to load punches");
      setPunches([]);
    } finally {
      setLoading(false);
    }
  };

  const lockDay = async () => {
    try {
      setLockLoading(true);
      setLockMessage(null);
      const result = await autoLockAttendance({ date });
      if (!result.success) {
        throw new Error(result.error || "Failed to lock attendance");
      }
      setLockMessage(
        `Locked ${result.data?.lockedCount ?? 0} attendance row(s) for ${date}.`
      );
      await load();
    } catch (err) {
      setLockMessage(
        err instanceof Error ? err.message : "Failed to lock attendance"
      );
    } finally {
      setLockLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    rows,
    loading,
    error,
    punchError,
    date,
    punches,
    lockLoading,
    lockMessage,
    setDate,
    setPunchError,
    load,
    lockDay,
  };
}
