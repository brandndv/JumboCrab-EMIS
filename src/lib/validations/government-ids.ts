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
});

export type GovernmentIdInput = z.infer<typeof governmentIdSchema>;
