import { z } from "zod";
import { APP_ROLES } from "@/lib/rbac";

// // Create a type that matches your form data structure
// type UserFormData = Omit<
//   PrismaUser,
//   "id" | "createdAt" | "updatedAt" | "password" | "salt"
// > & {
//   id?: string;
//   createdAt?: Date;
//   updatedAt?: Date;
// };

export const userSchema = z.object({
  userId: z.string().optional(),
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  role: z.enum(APP_ROLES).default("employee"),
  isDisabled: z.boolean().default(false),
  emailVerified: z.date().nullable().optional(),
  image: z.string().nullable().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type User = z.infer<typeof userSchema>;
export type UserFormValues = User; // Alias for consistency with your codebase

export type UserWithEmployee = User & {
  employee?: {
    employeeId?: string | null;
    employeeCode?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    position?: string | null;
    department?: string | null;
    employmentStatus?: string | null;
    currentStatus?: string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    img?: string | null;
  } | null;
};

export function validateUser(data: unknown): {
  success: boolean;
  data?: User;
  error?: string;
} {
  const result = userSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", "),
    };
  }
  return { success: true, data: result.data };
}
