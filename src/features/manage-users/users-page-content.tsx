"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { UsersCards } from "@/features/manage-users/users-cards";
import { useUsers } from "@/features/manage-users/users-provider";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation"; // Note: Use 'next/navigation' instead of 'next/router'
import { Search } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { deleteUser, updateUser } from "@/actions/users/users-action";
import { UsersLoadingState } from "@/features/manage-users/users-loading-state";
import type { UserWithEmployee } from "@/lib/validations/users";

const UnassignedEmployees = dynamic(
  () =>
    import("@/features/manage-users/unassigned-employees").then((module) => ({
      default: module.UnassignedEmployees,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Loading unassigned employees...
        </p>
      </div>
    ),
  },
);

export default function UsersPageContent() {
  const { users, loading, error, refreshUsers } = useUsers();
  const [managementSearch, setManagementSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [disabledSearch, setDisabledSearch] = useState("");
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname();
  const basePath = pathname.replace(/\/$/, "");

  function handleView(user: UserWithEmployee) {
    console.log("View user", user.userId);
    if (!user.userId) {
      console.error("No User ID provided for view");
      return;
    }
    // This is the correct path - don't include route groups
    router.push(`${basePath}/${user.userId}/view`);
  }

  const handleEdit = (user: UserWithEmployee) => {
    if (!user?.userId) return;
    router.push(`${basePath}/${user.userId}/edit`);
  };

  const toggleDisable = async (user: UserWithEmployee, isDisabled: boolean) => {
    if (!user?.userId) return;
    const confirmed = window.confirm(
      `${isDisabled ? "Disable" : "Enable"} ${user.username}?`,
    );
    if (!confirmed) return;
    try {
      const result = await updateUser({ userId: user.userId, isDisabled });
      if (!result.success) {
        throw new Error(result.error || "Failed to update user status");
      }
      await refreshUsers();
      toast.success(
        isDisabled ? "User disabled successfully." : "User enabled successfully.",
        {
          description: `${user.username} has been ${isDisabled ? "disabled" : "enabled"}.`,
        },
      );
    } catch (err) {
      console.error("Status update failed:", err);
      toast.error("Failed to update user.", {
        description: err instanceof Error ? err.message : "Failed to update user.",
      });
    }
  };

  const handleDisable = (user: UserWithEmployee) => toggleDisable(user, true);
  const handleEnable = (user: UserWithEmployee) => toggleDisable(user, false);

  const handleDelete = async (user: UserWithEmployee) => {
    if (!user?.userId) return;
    const confirmed = window.confirm(
      `Delete ${user.username}? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      const result = await deleteUser({ userId: user.userId });
      if (!result.success) {
        throw new Error(result.error || "Failed to delete user");
      }
      await refreshUsers();
      toast.success("User deleted successfully.", {
        description: `${user.username} has been removed.`,
      });
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete user.", {
        description: err instanceof Error ? err.message : "Failed to delete user.",
      });
    }
  };

  if (loading) return <UsersLoadingState />;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  const matchesTerm = (user: UserWithEmployee, term: string) => {
    if (!term.trim()) return true;
    const value = term.toLowerCase();
    const fullName = `${user.employee?.firstName ?? ""} ${
      user.employee?.lastName ?? ""
    }`.toLowerCase();
    return (
      user.username?.toLowerCase().includes(value) ||
      user.email?.toLowerCase().includes(value) ||
      fullName.includes(value) ||
      user.employee?.employeeCode?.toLowerCase().includes(value) ||
      user.employee?.position?.toLowerCase().includes(value)
    );
  };

  const activeUsers = users.filter((user) => !user.isDisabled);
  const managementUsers = activeUsers
    .filter((user) =>
      ["admin", "generalManager", "manager", "supervisor"].includes(user.role),
    )
    .filter((user) => matchesTerm(user, managementSearch));
  const employeeUsers = activeUsers
    .filter((user) => user.role === "employee")
    .filter((user) => matchesTerm(user, employeeSearch));
  const disabledUsers = users
    .filter((user) => user.isDisabled)
    .filter((user) => matchesTerm(user, disabledSearch));

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your User Accounts
          </p>
        </div>
        <Button
          onClick={() => router.push(`${basePath}/create`)}
          className="w-full md:w-auto"
        >
          Add New User
        </Button>
      </div>

      <div className="space-y-8 mt-6">
        <section className="mt-6 bg-card text-card-foreground border border-border shadow-sm rounded-xl p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Role Group
              </p>
              <h2 className="text-2xl font-semibold">Management</h2>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground self-start sm:self-auto">
                {managementUsers.length}{" "}
                {managementUsers.length === 1 ? "user" : "users"}
              </span>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search management..."
                  value={managementSearch}
                  onChange={(e) => setManagementSearch(e.target.value)}
                  className="w-full rounded-full border border-border bg-background px-10 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
          {managementUsers.length > 0 ? (
            <UsersCards
              users={managementUsers}
              onEdit={handleEdit}
              onDisable={handleDisable}
              onEnable={handleEnable}
              onDelete={handleDelete}
              onView={handleView}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No management users found.
            </p>
          )}
        </section>

        <section className="mt-6 bg-card text-card-foreground border border-border shadow-sm rounded-xl p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Role Group
              </p>
              <h2 className="text-2xl font-semibold">Employee</h2>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground self-start sm:self-auto">
                {employeeUsers.length}{" "}
                {employeeUsers.length === 1 ? "user" : "users"}
              </span>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full rounded-full border border-border bg-background px-10 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
          {employeeUsers.length > 0 ? (
            <UsersCards
              users={employeeUsers}
              onEdit={handleEdit}
              onDisable={handleDisable}
              onEnable={handleEnable}
              onDelete={handleDelete}
              onView={handleView}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No employee accounts found.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Status
              </p>
              <h2 className="text-2xl font-semibold text-destructive whitespace-nowrap">
                Disabled Accounts
              </h2>
              <p className="text-sm text-muted-foreground">
                Accounts that cannot sign in
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground self-start sm:self-auto">
                {disabledUsers.length}{" "}
                {disabledUsers.length === 1 ? "user" : "users"}
              </span>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search disabled users..."
                  value={disabledSearch}
                  onChange={(e) => setDisabledSearch(e.target.value)}
                  className="w-full rounded-full border border-border bg-background px-10 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
          {disabledUsers.length > 0 ? (
            <UsersCards
              users={disabledUsers}
              onEdit={handleEdit}
              onDisable={handleDisable}
              onEnable={handleEnable}
              onDelete={handleDelete}
              onView={handleView}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No disabled accounts.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <UnassignedEmployees />
        </section>
      </div>
    </div>
  );
}
