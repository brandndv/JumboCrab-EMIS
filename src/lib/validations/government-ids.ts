import { ContributionType } from "@prisma/client";
import { z } from "zod";

// Treat empty strings as null and trim whitespace for ID numbers
const idField = z
  .string()
  .transform((val) => val.trim())
  .transform((val) => (val === "" ? null : val))
  .refine(
    (val) => val === null || (val.length >= 4 && val.length <= 32),
    "ID must be between 4 and 32 characters"
  )
  .nullable()
  .optional();

export const governmentIdSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  tinNumber: idField,
  sssNumber: idField,
  philHealthNumber: idField,
  pagIbigNumber: idField,
  isSssIncludedInPayroll: z.boolean().optional(),
  isPhilHealthIncludedInPayroll: z.boolean().optional(),
  isWithholdingIncludedInPayroll: z.boolean().optional(),
  isPagIbigIncludedInPayroll: z.boolean().optional(),
});

export type GovernmentIdInput = z.infer<typeof governmentIdSchema>;

export const contributionPayrollInclusionSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  contributionType: z.nativeEnum(ContributionType),
  includeInPayroll: z.boolean(),
});

export type ContributionPayrollInclusionInput = z.infer<
  typeof contributionPayrollInclusionSchema
>;
