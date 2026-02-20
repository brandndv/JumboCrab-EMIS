"use client";

import { useCallback, useEffect, useState } from "react";
import { getUsers } from "@/actions/users/users-action";
import { User } from "@/lib/validations/users";

export function useUsersState(initialUsers: User[] = []) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [filteredUsers, setFilteredUsers] = useState<User[]>(initialUsers);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const fetchUsersData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchUsersData();
  }, [fetchUsersData]);

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

  return {
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
}

export type UsersState = ReturnType<typeof useUsersState>;
