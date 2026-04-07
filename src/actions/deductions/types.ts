import {
  DeductionAmountMode,
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
  EmployeeDeductionWorkflowStatus,
} from "@prisma/client";

export type DeductionTypePayload = {
  code?: string | null;
  name: string;
  description?: string | null;
  amountMode: DeductionAmountMode;
  frequency: DeductionFrequency;
  defaultAmount?: string | number | null;
  defaultPercent?: string | number | null;
  isActive?: boolean | null;
};

export type DeductionAssignmentPayload = {
  id?: string | null;
  employeeId: string;
  deductionTypeId: string;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
  amountOverride?: string | number | null;
  percentOverride?: string | number | null;
  installmentTotal?: string | number | null;
  installmentPerPayroll?: string | number | null;
  remainingBalance?: string | number | null;
  status?: EmployeeDeductionAssignmentStatus | null;
  reason?: string | null;
};

export type DeductionPaymentPayload = {
  id: string;
  amount: string | number;
  paymentDate: string | Date;
  remarks?: string | null;
};

export type DeductionTypeRow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  amountMode: DeductionAmountMode;
  frequency: DeductionFrequency;
  defaultAmount?: number | null;
  defaultPercent?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByName?: string | null;
  updatedByName?: string | null;
};

export type DeductionEmployeeOption = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  departmentName?: string | null;
};

export type DeductionAssignmentRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName?: string | null;
  avatarUrl?: string | null;
  deductionTypeId: string;
  deductionCode: string;
  deductionName: string;
  deductionDescription?: string | null;
  deductionTypeIsActive: boolean;
  amountMode: DeductionAmountMode;
  frequency: DeductionFrequency;
  defaultAmount?: number | null;
  defaultPercent?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  amountOverride?: number | null;
  percentOverride?: number | null;
  installmentTotal?: number | null;
  installmentPerPayroll?: number | null;
  remainingBalance?: number | null;
  workflowStatus: EmployeeDeductionWorkflowStatus;
  status: EmployeeDeductionAssignmentStatus;
  reason?: string | null;
  assignedByUserId?: string | null;
  assignedByName?: string | null;
  reviewedByUserId?: string | null;
  reviewedByName?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewRemarks?: string | null;
  payments: DeductionPaymentRow[];
  createdAt: string;
  updatedAt: string;
};

export type DeductionPaymentRow = {
  id: string;
  amount: number;
  paymentDate: string;
  remarks?: string | null;
  createdAt: string;
  createdByUserId?: string | null;
  createdByName?: string | null;
};
