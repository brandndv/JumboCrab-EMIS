"use client";

import type { ReactNode } from "react";
import {
  ContributionsContext,
  useContributionsState,
} from "@/hooks/use-contributions";

export function ContributionsProvider({ children }: { children: ReactNode }) {
  const value = useContributionsState();
  return (
    <ContributionsContext.Provider value={value}>
      {children}
    </ContributionsContext.Provider>
  );
}

export default ContributionsProvider;
