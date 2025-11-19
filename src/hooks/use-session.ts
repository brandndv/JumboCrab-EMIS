// src/hooks/use-session.ts
"use client";

import { useEffect, useState } from "react";
import { Session } from "@/types/session";
import { fetchSession } from "@/actions/session-action";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const result = await fetchSession();
        if (!result.success || !result.session) {
          throw new Error(result.error || "Failed to load session");
        }
        setSession(result.session);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  return { session, loading, error };
}
