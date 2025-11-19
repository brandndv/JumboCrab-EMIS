"use client";

import { UsersCards } from "@/components/dasboard/manage-users/users-cards";
import UsersProvider, {
  useUsers,
} from "@/components/dasboard/manage-users/users-provider";

function UsersPageContent() {
  const { filteredUsers, loading, error, searchTerm, setSearchTerm } = useUsers();

  const handleEdit = (user: any) => {
    console.log("Edit user:", user);
    // Add your edit logic here
  };

  const handleDelete = (user: any) => {
    if (confirm(`Are you sure you want to delete ${user.username}?`)) {
      console.log("Delete user:", user.id);
      // Add your delete logic here
    }
  };

  if (loading) return <div>Loading users...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  const managementUsers = filteredUsers.filter((user) =>
    ["admin", "generalManager", "manager", "supervisor", "clerk"].includes(
      user.role
    )
  );
  const employeeUsers = filteredUsers.filter((user) => user.role === "employee");

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-12">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          User Directory
        </p>
        <h1 className="text-3xl font-semibold leading-tight">
          Manage Access & Roles
        </h1>
        <p className="text-sm text-muted-foreground">
          Quickly review who has access to what by role group.
        </p>
      </div>

      <div className="space-y-8">
        <section className="rounded-2xl border border-border bg-card/40 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Role Group
              </p>
              <h2 className="text-2xl font-semibold">Management</h2>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {managementUsers.length}{" "}
              {managementUsers.length === 1 ? "user" : "users"}
            </span>
          </div>
          {managementUsers.length > 0 ? (
            <UsersCards
              users={managementUsers}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No management users found.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-6 shadow-sm">
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
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:max-w-xs"
              />
            </div>
          </div>
          {employeeUsers.length > 0 ? (
            <UsersCards
              users={employeeUsers}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No employee accounts found.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <UsersProvider>
      <UsersPageContent />
    </UsersProvider>
  );
}
