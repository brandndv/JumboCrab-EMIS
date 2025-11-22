// src/types/session.ts
import { User } from "@/lib/validations/users";
import { Employee } from "@/lib/validations/employees";

export interface Session {
  user: User & {
    employee?: Employee | null;
  };
  expires: string;
}
