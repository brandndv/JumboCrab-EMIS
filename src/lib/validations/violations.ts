import { z } from "zod";

export const violationsSchema = z.object({
  id: z.string().optional(),
  employeeId: z.string().min(1),
  violationId: z.string().min(1),
  violationDate: z.coerce.date(),
  strikePointsSnapshot: z.number().int().nonnegative().optional(),
  isAcknowledged: z.boolean().default(false),
  acknowledgedAt: z.coerce.date().optional().nullable(),
  remarks: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : undefined)),
  isCountedForStrike: z.boolean().default(true),
  voidedAt: z.coerce.date().optional().nullable(),
  voidReason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type Violation = z.infer<typeof violationsSchema>;
export type ViolationFormValue = Violation;
