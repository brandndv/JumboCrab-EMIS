"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getUsers } from "@/actions/users-action";
import { User } from "@/lib/validations/users";

type UsersContextType = {
  users: User[];
  filteredUsers: User[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  refreshUsers: () => Promise<void>;
  selectedRole: string | null;
  setSelectedRole: (role: string | null) => void;
};

const UsersContext = createContext<UsersContextType | undefined>(undefined);

export function UsersProvider({
  children,
  initialUsers = [],
}: {
  children: React.ReactNode;
  initialUsers?: User[];
}) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [filteredUsers, setFilteredUsers] = useState<User[]>(initialUsers);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const fetchUsersData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getUsers();
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to fetch users");
      }
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, []);

  useEffect(() => {
    let result = [...users];
    if (selectedRole) {
      result = result.filter((user) => user.role === selectedRole);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (user) =>
          user.username?.toLowerCase().includes(term) ||
          user.email?.toLowerCase().includes(term)
      );
    }
    setFilteredUsers(result);
  }, [users, searchTerm, selectedRole]);

  const contextValue = {
    users,
    filteredUsers,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    selectedRole,
    setSelectedRole,
    refreshUsers: fetchUsersData,
  };

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
