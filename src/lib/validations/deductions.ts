import {
  DeductionAmountMode,
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
} from "@prisma/client";
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

const percentField = numberField
  .refine(
    (value) => value == null || value >= 0,
    "Percent cannot be negative",
  )
  .refine((value) => value == null || value <= 100, "Percent cannot exceed 100");

const dateField = z
  .union([z.string(), z.date()])
  .transform((value) => {
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });

export const deductionTypeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .max(32)
      .optional()
      .transform((value) => (value ? value : undefined)),
    name: z.string().trim().min(1, "Name is required").max(100),
    description: optionalTrimmedString,
    amountMode: z.nativeEnum(DeductionAmountMode),
    frequency: z.nativeEnum(DeductionFrequency),
    defaultAmount: moneyField,
    defaultPercent: percentField,
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((value, ctx) => {
    if (
      value.amountMode === DeductionAmountMode.FIXED &&
      typeof value.defaultAmount !== "number"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultAmount"],
        message: "Default amount is required for fixed deductions",
      });
    }
    if (
      value.amountMode === DeductionAmountMode.PERCENT &&
      typeof value.defaultPercent !== "number"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultPercent"],
        message: "Default percent is required for percent deductions",
      });
    }
  });

export const deductionAssignmentSchema = z
  .object({
    id: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined)),
    employeeId: z.string().trim().min(1, "Employee is required"),
    deductionTypeId: z.string().trim().min(1, "Deduction type is required"),
    effectiveFrom: dateField,
    effectiveTo: dateField.optional(),
    amountOverride: moneyField,
    percentOverride: percentField,
    installmentTotal: moneyField,
    installmentPerPayroll: moneyField,
    remainingBalance: moneyField,
    status: z.nativeEnum(EmployeeDeductionAssignmentStatus).optional(),
    reason: optionalTrimmedString,
  })
  .superRefine((value, ctx) => {
    if (!value.effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveFrom"],
        message: "Effective from date is required",
      });
    }
    if (
      value.effectiveFrom &&
      value.effectiveTo &&
      value.effectiveTo < value.effectiveFrom
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveTo"],
        message: "Effective to must be on or after effective from",
      });
    }
  });

export const deductionPaymentSchema = z.object({
  id: z.string().trim().min(1, "Assignment is required"),
  amount: moneyField
    .refine((value) => typeof value === "number" && value > 0, "Payment amount is required"),
  paymentDate: dateField,
  remarks: optionalTrimmedString,
}).superRefine((value, ctx) => {
  if (!value.paymentDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paymentDate"],
      message: "Payment date is required",
    });
  }
});

export type DeductionTypeInput = z.infer<typeof deductionTypeSchema>;
export type DeductionAssignmentInput = z.infer<typeof deductionAssignmentSchema>;
export type DeductionPaymentInput = z.infer<typeof deductionPaymentSchema>;
