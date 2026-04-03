"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { useUsersState } from "@/hooks/use-users";
import type { User } from "@/lib/validations/users";

const UsersContext = createContext<
  ReturnType<typeof useUsersState> | undefined
>(undefined);

export function UsersProvider({
  children,
  initialUsers = [],
}: {
  children: ReactNode;
  initialUsers?: User[];
}) {
  const contextValue = useUsersState(initialUsers);

  return (
    <UsersContext.Provider value={contextValue}>
      {children}
    </UsersContext.Provider>
  );
}

export function useUsers() {
  const context = useContext(UsersContext);
  if (context === undefined) {
    throw new Error("useUsers must be used within a UsersProvider");
  }
  return context;
}

export default UsersProvider;
