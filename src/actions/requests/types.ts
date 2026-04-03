import {
  CashAdvanceRequestStatus,
  DayOffRequestStatus,
  EmployeeDeductionAssignmentStatus,
  LeaveRequestStatus,
  LeaveRequestType,
  ScheduleChangeRequestStatus,
  ScheduleSwapRequestStatus,
} from "@prisma/client";

export type CashAdvanceRequestPayload = {
  amount: string | number;
  repaymentPerPayroll: string | number;
  preferredStartDate: string | Date;
  reason?: string | null;
};

export type LeaveRequestPayload = {
  leaveType: LeaveRequestType | string;
  startDate: string | Date;
  endDate: string | Date;
  reason?: string | null;
};

export type DayOffRequestPayload = {
  workDate: string | Date;
  reason?: string | null;
};

export type ScheduleSwapRequestPayload = {
  coworkerEmployeeId: string;
  workDate: string | Date;
  reason?: string | null;
};

export type ScheduleChangeRequestPayload = {
  workDate: string | Date;
  requestedShiftId: string | number;
  reason?: string | null;
};

export type RequestReviewPayload = {
  id: string;
  decision: "APPROVED" | "REJECTED";
  managerRemarks?: string | null;
  paidDates?: Array<string | Date> | null;
};

export type ScheduleSwapCoworkerReviewPayload = {
  id: string;
  decision: "ACCEPTED" | "DECLINED";
  coworkerRemarks?: string | null;
};

export type CashAdvanceRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  amount: number;
  repaymentPerPayroll: number;
  preferredStartDate: string;
  reason?: string | null;
  status: CashAdvanceRequestStatus;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  deductionAssignmentId?: string | null;
  linkedDeductionStatus?: EmployeeDeductionAssignmentStatus | null;
  linkedDeductionEffectiveFrom?: string | null;
  linkedDeductionRemainingBalance?: number | null;
};

export type LeaveRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  leaveType: LeaveRequestType;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: LeaveRequestStatus;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  totalDays: number;
  paidDaysCount: number;
  unpaidDaysCount: number;
  paidDateList: string[];
  unpaidDateList: string[];
};

export type EmployeeLeaveBalanceSummary = {
  year: number;
  paidLeaveAllowance: number;
  paidLeaveUsed: number;
  paidLeaveRemaining: number;
  paidSickLeaveAllowance: number;
  paidSickLeaveUsed: number;
  paidSickLeaveRemaining: number;
};

export type EmployeeDayOffMonthlySummary = {
  year: number;
  month: number;
  monthLabel: string;
  approvedThisMonth: number;
};

export type DayOffPreview = {
  workDate: string;
  employee: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
  };
  current: {
    shiftId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    shiftLabel: string;
  };
  resultLabel: string;
  wouldChange: boolean;
};

export type DayOffRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  workDate: string;
  currentShiftLabel: string;
  reason?: string | null;
  status: DayOffRequestStatus;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleChangeShiftOption = {
  id: number;
  code: string;
  name: string;
  shiftLabel: string;
};

export type ScheduleChangePreview = {
  workDate: string;
  employee: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
  };
  current: {
    shiftId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    shiftLabel: string;
  };
  requested: {
    shiftId: number;
    shiftCode: string;
    shiftName: string;
    shiftLabel: string;
  };
  wouldChange: boolean;
};

export type ScheduleChangeRequestRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  workDate: string;
  currentShiftLabel: string;
  requestedShiftLabel: string;
  requestedShiftId: number;
  reason?: string | null;
  status: ScheduleChangeRequestStatus;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleSwapEmployeeOption = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
};

export type ScheduleSwapPreview = {
  workDate: string;
  requester: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    shiftId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    shiftLabel: string;
  };
  coworker: {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    shiftId: number | null;
    shiftCode: string | null;
    shiftName: string | null;
    shiftLabel: string;
  };
  wouldChange: boolean;
};

export type ScheduleSwapRequestRow = {
  id: string;
  requesterEmployeeId: string;
  requesterEmployeeCode: string;
  requesterEmployeeName: string;
  coworkerEmployeeId: string;
  coworkerEmployeeCode: string;
  coworkerEmployeeName: string;
  workDate: string;
  requesterShiftLabel: string;
  coworkerShiftLabel: string;
  reason?: string | null;
  status: ScheduleSwapRequestStatus;
  coworkerRemarks?: string | null;
  managerRemarks?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  coworkerRespondedAt?: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  isIncomingToViewer: boolean;
  isOutgoingFromViewer: boolean;
};
