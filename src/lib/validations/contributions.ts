import { z } from "zod";

// Treat empty strings as 0, enforce non-negative, keep simple upper bound to catch input mistakes.
const moneyField = z
  .union([z.string(), z.number()])
  .transform((val) => (typeof val === "string" ? val.trim() : val))
  .transform((val) => {
    if (val === "" || val === null || typeof val === "undefined") return 0;
    const num = typeof val === "number" ? val : Number(val);
    return Number.isFinite(num) ? num : 0;
  })
  .refine((val) => val >= 0, "Amount cannot be negative")
  .refine((val) => val <= 1_000_000, "Amount seems too large");

export const employeeContributionSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  sssEe: moneyField,
  sssEr: moneyField,
  isSssActive: z.boolean().optional().default(true),
  philHealthEe: moneyField,
  philHealthEr: moneyField,
  isPhilHealthActive: z.boolean().optional().default(true),
  pagIbigEe: moneyField,
  pagIbigEr: moneyField,
  isPagIbigActive: z.boolean().optional().default(true),
  withholdingEe: moneyField,
  withholdingEr: moneyField,
  isWithholdingActive: z.boolean().optional().default(true),
  effectiveDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (val ? new Date(val) : new Date())),
});

export type EmployeeContributionInput = z.infer<typeof employeeContributionSchema>;
