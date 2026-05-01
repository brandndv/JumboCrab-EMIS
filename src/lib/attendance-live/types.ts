export type AttendanceLiveRow = {
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
  employee: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null } | null;
    position?: { name: string | null } | null;
  } | null;
};

export type AttendanceLivePunch = {
  id: string;
  employeeId: string;
  attendanceId?: string | null;
  punchType: string;
  punchTime: string;
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
  employee: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null } | null;
    position?: { name: string | null } | null;
  } | null;
};

export type AttendanceLiveEvent = {
  employeeId: string;
  workDate: string;
  attendance: AttendanceLiveRow | null;
  punch: AttendanceLivePunch | null;
  deletedPunchId?: string | null;
  publishedAt: string;
};
