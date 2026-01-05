"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { useContributionsState } from "@/hooks/use-contributions";

const ContributionsContext = createContext<
  ReturnType<typeof useContributionsState> | undefined
>(undefined);

export function ContributionsProvider({ children }: { children: ReactNode }) {
  const value = useContributionsState();
  return (
    <ContributionsContext.Provider value={value}>
      {children}
    </ContributionsContext.Provider>
  );
}

export function useContributions() {
  const context = useContext(ContributionsContext);
  if (!context) {
    throw new Error(
      "useContributions must be used within a ContributionsProvider"
    );
  }
  return context;
}

export default ContributionsProvider;
