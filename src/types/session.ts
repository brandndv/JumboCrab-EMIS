// src/types/session.ts
import { Roles } from "@prisma/client";

export interface Session {
  id?: string;
  username?: string;
  email?: string;
  role?: Roles;
  isLoggedIn: boolean;
}
