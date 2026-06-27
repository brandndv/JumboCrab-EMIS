// src/types/session.ts
import { User } from "@/lib/validations/users";
import { Employee } from "@/lib/validations/employees";

export interface Session {
  user: User & {
    employee?: Employee | null;
    switchAccount?: {
      userId: string;
      role: string;
      label: string;
      href: string;
    } | null;
  };
  expires: string;
}
