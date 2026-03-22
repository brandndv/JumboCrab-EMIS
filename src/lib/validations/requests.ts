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

const dateField = z
  .union([z.string(), z.date()])
  .transform((value) => {
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });

const dateArrayField = z
  .array(dateField)
  .optional()
  .transform((value) =>
    (value ?? []).filter(
      (item): item is Date => item instanceof Date && !Number.isNaN(item.getTime()),
    ),
  );

export const cashAdvanceRequestSchema = z
  .object({
    amount: moneyField.refine(
      (value) => typeof value === "number" && value > 0,
      "Cash advance amount is required",
    ),
    repaymentPerPayroll: moneyField.refine(
      (value) => typeof value === "number" && value > 0,
      "Repayment per payroll is required",
    ),
    preferredStartDate: dateField,
    reason: optionalTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (!value.preferredStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["preferredStartDate"],
        message: "Preferred start date is required",
      });
    }
    if (
      typeof value.amount === "number" &&
      typeof value.repaymentPerPayroll === "number" &&
      value.repaymentPerPayroll > value.amount
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["repaymentPerPayroll"],
        message: "Repayment per payroll cannot exceed the requested amount",
      });
    }
  });

export const cashAdvanceReviewSchema = z
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

export const leaveRequestSchema = z
  .object({
    leaveType: z.enum(["VACATION", "SICK", "PERSONAL", "EMERGENCY", "UNPAID"]),
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

export const leaveReviewSchema = cashAdvanceReviewSchema.safeExtend({
  paidDates: dateArrayField,
});

export const dayOffRequestSchema = z
  .object({
    workDate: dateField,
    reason: optionalTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (!value.workDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workDate"],
        message: "Day off date is required",
      });
    }
  });

export const scheduleChangeRequestSchema = z
  .object({
    workDate: dateField,
    requestedShiftId: numberField.refine(
      (value) => typeof value === "number" && Number.isInteger(value) && value > 0,
      "Requested shift is required",
    ),
    reason: optionalTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (!value.workDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workDate"],
        message: "Work date is required",
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

export const scheduleSwapManagerReviewSchema = cashAdvanceReviewSchema;

export type CashAdvanceRequestInput = z.infer<typeof cashAdvanceRequestSchema>;
export type CashAdvanceReviewInput = z.infer<typeof cashAdvanceReviewSchema>;
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
