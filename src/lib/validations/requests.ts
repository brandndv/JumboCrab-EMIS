import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value ? value : undefined));

const numberField = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return undefined;
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  });

const moneyField = numberField
  .refine((value) => value == null || value >= 0, "Amount cannot be negative")
  .refine(
    (value) => value == null || value <= 1_000_000,
    "Amount seems too large",
  );

const positiveMoneyField = moneyField.refine(
  (value) => typeof value === "number" && value > 0,
  "Amount is required",
);

const termMonthsField = numberField.refine(
  (value) => value === 12 || value === 24,
  "Repayment term must be 12 or 24 months",
);

const dateField = z
  .union([z.string(), z.date()])
  .transform((value) => {
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });

export const cashAdvanceRequestSchema = z.object({
  amount: moneyField.refine(
    (value) => typeof value === "number" && value > 0,
    "Cash advance amount is required",
  ),
  preferredStartDate: dateField.optional(),
  reason: optionalTrimmedString,
}).superRefine((value, ctx) => {
  if (!value.preferredStartDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["preferredStartDate"],
      message: "Preferred bimonthly date is required",
    });
  }
});

export const governmentLoanAssistanceRequestSchema = z.object({
  agency: z.enum(["SSS_SALARY_LOAN", "PAGIBIG_MPL"]),
  requestedAmount: positiveMoneyField,
  termMonths: termMonthsField,
  employeeRemarks: optionalTrimmedString,
});

export const governmentLoanStatusUpdateSchema = z
  .object({
    id: z.string().trim().min(1, "Request is required"),
    status: z.enum(["PROCESSING", "APPROVED_BY_AGENCY", "DECLINED_BY_AGENCY"]),
    managerRemarks: optionalTrimmedString,
    agencyRemarks: optionalTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (value.status === "DECLINED_BY_AGENCY" && !value.agencyRemarks && !value.managerRemarks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["agencyRemarks"],
        message: "Remarks are required when the agency declines a request",
      });
    }
  });

export const governmentLoanFinalizeSchema = z
  .object({
    id: z.string().trim().min(1, "Request is required"),
    approvedAmount: positiveMoneyField,
    approvedMonthlyPayment: positiveMoneyField,
    repaymentStartDate: dateField.optional(),
    managerRemarks: optionalTrimmedString,
    agencyRemarks: optionalTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (!value.repaymentStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["repaymentStartDate"],
        message: "Repayment start date is required",
      });
    }
    if (
      typeof value.approvedAmount === "number" &&
      typeof value.approvedMonthlyPayment === "number" &&
      value.approvedMonthlyPayment > value.approvedAmount
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approvedMonthlyPayment"],
        message: "Monthly payment cannot exceed approved amount",
      });
    }
  });

export const silEncashmentRequestSchema = z.object({
  days: z.coerce
    .number()
    .int("SIL days must be a whole number")
    .min(1, "Select at least 1 SIL day")
    .max(30, "SIL days is too high"),
  employeeRemarks: optionalTrimmedString,
});

export const requestReviewSchema = z
  .object({
    id: z.string().trim().min(1, "Request is required"),
    decision: z.enum(["APPROVED", "REJECTED"]),
    managerRemarks: optionalTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (value.decision === "REJECTED" && !value.managerRemarks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["managerRemarks"],
        message: "Manager remarks are required when rejecting a request",
      });
    }
  });

export const cashAdvanceReviewSchema = requestReviewSchema
  .safeExtend({
    approvedAmount: moneyField.optional(),
    deductionMode: z
      .enum(["FULL_NEXT_PAYROLL", "INSTALLMENTS"])
      .optional(),
    approvedRepaymentPerPayroll: moneyField.optional(),
    approvedEffectiveFrom: dateField.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "APPROVED") {
      if (!(typeof value.approvedAmount === "number" && value.approvedAmount > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["approvedAmount"],
          message: "Approved amount is required",
        });
      }

      if (!value.deductionMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deductionMode"],
          message: "Deduction mode is required",
        });
      }

      if (!value.approvedEffectiveFrom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["approvedEffectiveFrom"],
          message: "Effective date is required",
        });
      }

      if (value.deductionMode === "INSTALLMENTS") {
        if (
          !(
            typeof value.approvedRepaymentPerPayroll === "number" &&
            value.approvedRepaymentPerPayroll > 0
          )
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["approvedRepaymentPerPayroll"],
            message: "Repayment per payroll is required for installments",
          });
        }
        if (
          typeof value.approvedAmount === "number" &&
          typeof value.approvedRepaymentPerPayroll === "number" &&
          value.approvedRepaymentPerPayroll > value.approvedAmount
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["approvedRepaymentPerPayroll"],
            message: "Repayment per payroll cannot exceed the approved amount",
          });
        }
      }
    }
  });

export const leaveRequestSchema = z
  .object({
    leaveType: z.enum(["SICK", "SIL", "UNPAID"]),
    startDate: dateField,
    endDate: dateField,
    reason: optionalTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (!value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Leave start date is required",
      });
    }
    if (!value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Leave end date is required",
      });
    }
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Leave end date cannot be earlier than the start date",
      });
    }
  });

export const leaveReviewSchema = requestReviewSchema;

export const dayOffRequestSchema = z
  .object({
    sourceOffDate: dateField,
    targetWorkDate: dateField,
    reason: optionalTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (!value.sourceOffDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceOffDate"],
        message: "Current day off date is required",
      });
    }
    if (!value.targetWorkDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetWorkDate"],
        message: "Target work date is required",
      });
    }
    if (
      value.sourceOffDate &&
      value.targetWorkDate &&
      value.sourceOffDate.getTime() === value.targetWorkDate.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetWorkDate"],
        message: "Target work date must be different from your current day off",
      });
    }
  });

export const scheduleChangeRequestSchema = z
  .object({
    startDate: dateField,
    endDate: dateField,
    requestedShiftId: numberField.refine(
      (value) => typeof value === "number" && Number.isInteger(value) && value > 0,
      "Requested shift is required",
    ),
    reason: optionalTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (!value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Start date is required",
      });
    }
    if (!value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date is required",
      });
    }
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date cannot be earlier than the start date",
      });
    }
  });

export const scheduleSwapRequestSchema = z
  .object({
    coworkerEmployeeId: z.string().trim().min(1, "Coworker is required"),
    workDate: dateField,
    reason: optionalTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (!value.workDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workDate"],
        message: "Swap date is required",
      });
    }
  });

export const scheduleSwapCoworkerReviewSchema = z
  .object({
    id: z.string().trim().min(1, "Request is required"),
    decision: z.enum(["ACCEPTED", "DECLINED"]),
    coworkerRemarks: optionalTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (value.decision === "DECLINED" && !value.coworkerRemarks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coworkerRemarks"],
        message: "Remarks are required when declining a swap",
      });
    }
  });

export const scheduleSwapManagerReviewSchema = requestReviewSchema;

export type CashAdvanceRequestInput = z.infer<typeof cashAdvanceRequestSchema>;
export type CashAdvanceReviewInput = z.infer<typeof cashAdvanceReviewSchema>;
export type RequestReviewInput = z.infer<typeof requestReviewSchema>;
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;
export type LeaveReviewInput = z.infer<typeof leaveReviewSchema>;
export type DayOffRequestInput = z.infer<typeof dayOffRequestSchema>;
export type ScheduleChangeRequestInput = z.infer<
  typeof scheduleChangeRequestSchema
>;
export type ScheduleSwapRequestInput = z.infer<typeof scheduleSwapRequestSchema>;
export type ScheduleSwapCoworkerReviewInput = z.infer<
  typeof scheduleSwapCoworkerReviewSchema
>;
export type ScheduleSwapManagerReviewInput = z.infer<
  typeof scheduleSwapManagerReviewSchema
>;
