"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { useAttendanceState } from "@/hooks/use-attendance";

const AttendanceContext = createContext<
  ReturnType<typeof useAttendanceState> | undefined
>(undefined);

export function AttendanceProvider({
  children,
  initialDate,
  supervisorUserId,
}: {
  children: ReactNode;
  initialDate?: string;
  supervisorUserId?: string;
}) {
  const contextValue = useAttendanceState(initialDate, {
    supervisorUserId,
  });

  return (
    <AttendanceContext.Provider value={contextValue}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (context === undefined) {
    throw new Error("useAttendance must be used within an AttendanceProvider");
  }
  return context;
}

export default AttendanceProvider;
