import { z } from "zod";
import { User as PrismaUser, Roles } from "@prisma/client";

// Create a type that matches your form data structure
type UserFormData = Omit<PrismaUser, 'id' | 'createdAt' | 'updatedAt' | 'password' | 'salt'> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export const userSchema = z.object({
  id: z.string().optional(),
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(Roles).default(Roles.employee),
  isArchived: z.boolean().default(false),
  emailVerified: z.date().nullable().optional(),
  image: z.string().nullable().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type User = z.infer<typeof userSchema>;
export type UserFormValues = User;  // Alias for consistency with your codebase

export function validateUser(data: unknown): { success: boolean; data?: User; error?: string } {
  const result = userSchema.safeParse(data);
  if (!result.success) {
    return { 
      success: false, 
      error: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')
    };
  }
  return { success: true, data: result.data };
}