"use client";

import { createContext } from "react";
import type { RawSessionData } from "@/lib/session-shared";

export const SessionContext = createContext<RawSessionData | null | undefined>(
  undefined,
);

export function SessionProvider({
  initialSession,
  children,
}: {
  initialSession: RawSessionData | null;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={initialSession}>
      {children}
    </SessionContext.Provider>
  );
}
