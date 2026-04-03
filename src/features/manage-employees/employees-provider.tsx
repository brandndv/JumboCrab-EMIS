"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { useEmployeesState } from "@/hooks/use-employees";

const EmployeesContext = createContext<
  ReturnType<typeof useEmployeesState> | undefined
>(undefined);

export function EmployeesProvider({ children }: { children: ReactNode }) {
  const contextValue = useEmployeesState();

  return (
    <EmployeesContext.Provider value={contextValue}>
      {children}
    </EmployeesContext.Provider>
  );
}

export function useEmployees() {
  const context = useContext(EmployeesContext);
  if (context === undefined) {
    throw new Error("useEmployees must be used within an EmployeesProvider");
  }
  return context;
}
export default EmployeesProvider;
