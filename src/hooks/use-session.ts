"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { Session } from "@/types/session";
import { fetchSession } from "@/actions/auth/session-action";
import { User } from "@/lib/validations/users";
import { normalizeRole } from "@/lib/rbac";
import { SessionContext } from "@/components/providers/session-provider";
import type { RawSessionData } from "@/lib/session-shared";

type SharedSessionState = {
  loaded: boolean;
  session: Session | null;
  error: Error | null;
};

let sharedSessionState: SharedSessionState = {
  loaded: false,
  session: null,
  error: null,
};

let sharedSessionPromise: Promise<Session | null> | null = null;

function toSessionData(rawSession: RawSessionData | null | undefined) {
  if (!rawSession?.isLoggedIn || !(rawSession.userId || rawSession.id)) {
    return null;
  }

  const role = normalizeRole(rawSession.role) ?? "employee";

  const userData: User = {
    userId: rawSession.userId || rawSession.id || "",
    username: rawSession.username || "",
    email: rawSession.email || "",
    role,
    isDisabled: false,
  };

  return {
    user: {
      ...userData,
      employee: (rawSession.employee as Session["user"]["employee"]) ?? null,
    },
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  } satisfies Session;
}

async function loadSharedSession() {
  if (sharedSessionState.loaded) {
    if (sharedSessionState.error) {
      throw sharedSessionState.error;
    }
    return sharedSessionState.session;
  }

  if (!sharedSessionPromise) {
    sharedSessionPromise = fetchSession()
      .then((result) => {
        if (!result.success) {
          throw new Error(result.error || "Failed to load session");
        }

        const session = toSessionData(result.session as RawSessionData);
        sharedSessionState = {
          loaded: true,
          session,
          error: null,
        };
        return session;
      })
      .catch((error) => {
        const sessionError =
          error instanceof Error ? error : new Error("Unknown error");
        sharedSessionState = {
          loaded: true,
          session: null,
          error: sessionError,
        };
        throw sessionError;
      })
      .finally(() => {
        sharedSessionPromise = null;
      });
  }

  return sharedSessionPromise;
}

export function useSession() {
  const initialSession = useContext(SessionContext);
  const hasProvidedSession = initialSession !== undefined;

  const providedSession = useMemo(
    () => (hasProvidedSession ? toSessionData(initialSession) : null),
    [hasProvidedSession, initialSession],
  );

  const [session, setSession] = useState<Session | null>(
    hasProvidedSession
      ? providedSession
      : sharedSessionState.loaded
        ? sharedSessionState.session
        : null,
  );
  const [loading, setLoading] = useState(
    hasProvidedSession ? false : !sharedSessionState.loaded,
  );
  const [error, setError] = useState<Error | null>(
    hasProvidedSession ? null : sharedSessionState.error,
  );

  useEffect(() => {
    if (hasProvidedSession) {
      setSession(providedSession);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;

    const syncSession = async () => {
      try {
        const nextSession = await loadSharedSession();
        if (!active) {
          return;
        }
        setSession(nextSession);
        setError(null);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    syncSession();

    return () => {
      active = false;
    };
  }, [hasProvidedSession, providedSession]);

  const resolvedSession = hasProvidedSession ? providedSession : session;
  const resolvedLoading = hasProvidedSession ? false : loading;
  const resolvedError = hasProvidedSession ? null : error;

  return useMemo(
    () => ({
      session: resolvedSession,
      loading: resolvedLoading,
      error: resolvedError,
      // Helper getters
      get user() {
        return resolvedSession?.user;
      },
      get employee() {
        return resolvedSession?.user.employee;
      },
      get isAdmin() {
        return resolvedSession?.user.role === "admin";
      },
      get isEmployee() {
        return resolvedSession?.user.role === "employee";
      },
      get isManager() {
        return resolvedSession?.user.role === "manager";
      },
      get isGeneralManager() {
        return resolvedSession?.user.role === "generalManager";
      },
      get isSupervisor() {
        return resolvedSession?.user.role === "supervisor";
      },
    }),
    [resolvedError, resolvedLoading, resolvedSession],
  );
}
