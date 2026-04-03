"use client";

import { useViolationsState, violationsContext } from "@/hooks/use-violations";
import type { ReactNode } from "react";

const ViolationsProvider = ({ children }: { children: ReactNode }) => {
  const contextValue = useViolationsState();
  return (
    <violationsContext.Provider value={contextValue}>
      {children}
    </violationsContext.Provider>
  );
};

export default ViolationsProvider;
