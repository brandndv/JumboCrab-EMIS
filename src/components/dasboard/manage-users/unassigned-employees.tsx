"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getEmployeesWithoutUser } from "@/actions/employees/employees-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type UnassignedEmployee = {
  employeeId: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  email: string | null;
};

export function UnassignedEmployees() {
  const router = useRouter();
  const [employees, setEmployees] = useState<UnassignedEmployee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getEmployeesWithoutUser();
        if (!res.success || !res.data) {
          throw new Error(res.error || "Failed to load unassigned employees");
        }
        setEmployees(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return employees;
    return employees.filter((emp) =>
      `${emp.firstName} ${emp.lastName} ${emp.employeeCode} ${emp.email ?? ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [employees, search]);

  const handleCreate = (employeeId: string) => {
    router.push(`/admin/users/create?employeeId=${employeeId}`);
  };

  const handleViewEmployee = (employeeId: string) => {
    router.push(`/admin/employees/${employeeId}/view`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Accounts
          </p>
          <h2 className="text-2xl font-semibold">Unassigned Employees</h2>
          <p className="text-sm text-muted-foreground">
            Employees without user accounts. Create an account in one click.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          Loading unassigned employees...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-6 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
          All employees have accounts.
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="rounded-2xl border border-border/70 bg-card/60 shadow-sm overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 text-sm font-medium text-muted-foreground border-b border-border/70">
            <div className="col-span-3">Employee Code</div>
            <div className="col-span-4">Name</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <div className="divide-y divide-border/70">
            {filtered.map((emp) => (
              <div
                key={emp.employeeId}
                className="grid grid-cols-1 gap-3 px-4 py-4 text-sm items-start md:grid-cols-12 md:items-center"
              >
                <div className="md:col-span-3 font-medium">
                  <p className="text-xs text-muted-foreground md:hidden">Code</p>
                  {emp.employeeCode}
                </div>
                <div className="md:col-span-4">
                  <p className="text-xs text-muted-foreground md:hidden">Name</p>
                  {emp.firstName} {emp.lastName}
                </div>
                <div className="md:col-span-3 text-muted-foreground">
                  <p className="text-xs text-muted-foreground md:hidden">Email</p>
                  {emp.email || "No email"}
                </div>
                <div className="md:col-span-2 flex flex-col gap-2 md:flex-row md:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewEmployee(emp.employeeId)}
                    className="w-full md:w-auto"
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleCreate(emp.employeeId)}
                    className="w-full md:w-auto"
                  >
                    Create account
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
