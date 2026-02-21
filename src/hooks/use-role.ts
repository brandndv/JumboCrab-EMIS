// src/hooks/use-role.ts
"use client";

import { useState, useEffect } from "react";
import { getAuthRole } from "@/actions/auth/auth-action";
import { normalizeRole, type AppRole } from "@/lib/rbac";

export function useRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const result = await getAuthRole();
        if (result.success) {
          setRole(normalizeRole(result.role));
        }
      } catch (error) {
        console.error("Failed to fetch role:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRole();
  }, []);

  return { role, isLoading };
}
