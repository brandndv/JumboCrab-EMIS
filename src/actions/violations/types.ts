import type { EmployeeViolationStatus } from "@prisma/client";

export type ViolationResetFrequencyValue =
  | "MONTHLY"
  | "QUARTERLY"
  | "YEARLY";

export type ViolationRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  avatarUrl?: string | null;
  violationId: string;
  violationName: string;
  violationDescription?: string | null;
  violationDate: string;
  strikePointsSnapshot: number;
  status: EmployeeViolationStatus;
  draftedById?: string | null;
  submittedAt?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewRemarks?: string | null;
  isAcknowledged: boolean;
  acknowledgedAt?: string | null;
  isCountedForStrike: boolean;
  voidedAt?: string | null;
  voidReason?: string | null;
  remarks?: string | null;
  createdAt: string;
};

export type ViolationDefinitionOption = {
  violationId: string;
  name: string;
  description: string;
  defaultStrikePoints: number;
  maxStrikesPerEmployee: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ViolationEmployeeOption = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
};

export type EmployeeViolationResetRow = {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  violationId?: string | null;
  violationName?: string | null;
  effectiveFrom: string;
  reason: string;
  createdByUserId?: string | null;
  createdByName?: string | null;
  autoPolicyId?: string | null;
  createdAt: string;
};

export type ViolationAutoResetPolicyRow = {
  id: string;
  name?: string | null;
  frequency: ViolationResetFrequencyValue;
  dayOfMonth: number;
  monthOfYear?: number | null;
  effectiveFrom: string;
  nextRunAt: string;
  lastRunAt?: string | null;
  reasonTemplate?: string | null;
  appliesToAllEmployees: boolean;
  employeeId?: string | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  violationId?: string | null;
  violationName?: string | null;
  isActive: boolean;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ViolationStrikeProgressRow = {
  violationId: string;
  violationName: string;
  maxStrikesPerEmployee: number;
  currentCountedStrikes: number;
  progressLabel: string;
};
