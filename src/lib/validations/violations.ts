import { VIOLATION_TYPE } from "@prisma/client";
import z from "zod";

export const violationsSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  violationType: z.enum(VIOLATION_TYPE),
  violationDate: z.date(),
  amount: z.number().optional,
  paidAmount: z.number().default(0),
  remainingAmount: z.number().default(0),
  installmentAmount: z.number(),
  remarks: z.string().optional,
  createdAt: z.date,
});

export type Violation = z.infer<typeof violationsSchema>;
export type ViolationFormValue = Violation;
