import { z } from "zod";

// Enums from Prisma schema
export const GENDER = ["MALE", "FEMALE"] as const;
export type GENDER = (typeof GENDER)[number];

export const CIVIL_STATUS = [
  "SINGLE",
  "MARRIED",
  "DIVORCED",
  "WIDOWED",
] as const;
export type CIVIL_STATUS = (typeof CIVIL_STATUS)[number];

export const EMPLOYMENT_STATUS = [
  "REGULAR",
  "PROBATIONARY",
  "TRAINING",
] as const;
export type EMPLOYMENT_STATUS = (typeof EMPLOYMENT_STATUS)[number];

export const CURRENT_STATUS = [
  "ACTIVE",
  "ON_LEAVE",
  "VACATION",
  "SICK_LEAVE",
  "INACTIVE",
] as const;
export type CURRENT_STATUS = (typeof CURRENT_STATUS)[number];

// In src/lib/validations/employees.ts
export const SUFFIX = ["JR", "SR", "II", "III", "IV"] as const;
export type SUFFIX = (typeof SUFFIX)[number];

// Base employee schema matching Prisma model
export const employeeSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional().nullable(),
  employeeCode: z.string().min(1, "Employee code is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  middleName: z.string().optional().nullable(),
  suffix: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val.trim() === "") return null;
      return SUFFIX.includes(val as any) ? val : null;
    })
    .refine((val) => !val || SUFFIX.includes(val as any), {
      message: `Suffix must be one of: ${SUFFIX.join(", ")}`,
    }),
  sex: z.enum(GENDER),
  civilStatus: z.enum(CIVIL_STATUS),
  nationality: z.string().optional().nullable(),
  birthdate: z
    .union([z.string(), z.date()])
    .pipe(z.coerce.date())
    .refine((date) => date <= new Date(), "Birthdate cannot be in the future"),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  img: z.string().url("Invalid image URL").optional().nullable(),
  startDate: z
    .union([z.string(), z.date()])
    .pipe(z.coerce.date())
    .refine((date) => date <= new Date(), "Start date cannot be in the future"),
  endDate: z
    .union([z.string(), z.date()])
    .pipe(z.coerce.date())
    .refine((date) => date > new Date(), "End date must be in the future")
    .optional()
    .nullable(),
  position: z.string().min(1, "Position is required"),
  department: z.string().min(1, "Department is required"),
  employmentStatus: z.enum(EMPLOYMENT_STATUS),
  currentStatus: z.enum(CURRENT_STATUS),
  email: z.string().email("Invalid email").optional().nullable(),
  phone: z.string().optional().nullable(),
  emergencyContactName: z.string().min(1, "Emergency contact name is required").optional().nullable(),
  emergencyContactRelationship: z.string().min(1, "Relationship is required").optional().nullable(),
  emergencyContactPhone: z.string().min(1, "Emergency contact phone is required").optional().nullable(),
  emergencyContactEmail: z.string().email("Invalid emergency contact email").optional().nullable(),
  description: z.string().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Type for TypeScript
export type Employee = z.infer<typeof employeeSchema>;

// Validation functions
export const validateEmployee = (data: unknown) => {
  return employeeSchema.safeParse(data);
};

export const validatePartialEmployee = (data: unknown) => {
  return employeeSchema.partial().safeParse(data);
};

// Schema for creating a new employee (excludes auto-generated fields)
export const createEmployeeSchema = employeeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for updating an employee (all fields optional except id)
export const updateEmployeeSchema = employeeSchema.partial().extend({
  id: z.string().optional(),
});
