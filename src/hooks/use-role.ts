// src/hooks/use-role.ts
"use client";

import type { AppRole } from "@/lib/rbac";
import { useSession } from "./use-session";

export function useRole() {
  const { user, loading } = useSession();
  return { role: (user?.role ?? null) as AppRole | null, isLoading: loading };
}
