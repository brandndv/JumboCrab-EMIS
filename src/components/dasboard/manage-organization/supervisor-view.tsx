"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type SupervisorUser = {
  userId: string;
  username: string;
  email: string;
  role: string;
};

type EmployeeRow = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  supervisorUserId?: string | null;
  department?: { name: string | null };
  position?: { name: string | null };
};

type StructurePayload = {
  employees: EmployeeRow[];
  supervisors: SupervisorUser[];
};

export function SupervisorView() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/organization/structure");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load structure");
      setEmployees(json?.data ?? []);
      setSupervisors(json?.supervisors ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load structure");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, { sup: SupervisorUser; reports: EmployeeRow[] }>();
    supervisors.forEach((sup) => map.set(sup.userId, { sup, reports: [] }));
    const unassigned: EmployeeRow[] = [];
    employees.forEach((emp) => {
      if (emp.supervisorUserId && map.has(emp.supervisorUserId)) {
        map.get(emp.supervisorUserId)!.reports.push(emp);
      } else {
        unassigned.push(emp);
      }
    });
    return { groups: Array.from(map.values()), unassigned };
  }, [employees, supervisors]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Supervisor View</CardTitle>
          <p className="text-sm text-muted-foreground">
            See supervisors and their direct reports.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} aria-label="Reload">
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            {grouped.groups.length === 0 && grouped.unassigned.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {grouped.groups.map(({ sup, reports }) => (
                    <div key={sup.userId} className="rounded-lg border bg-muted/10 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">{sup.username}</p>
                          <p className="text-xs text-muted-foreground">{sup.role}</p>
                        </div>
                        <Badge variant="outline">{reports.length} reports</Badge>
                      </div>
                      {reports.length > 0 ? (
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {reports.map((emp) => (
                            <li key={emp.employeeId} className="flex justify-between gap-2">
                              <span>
                                {emp.firstName} {emp.lastName} ({emp.employeeCode})
                              </span>
                              <span className="text-xs">{emp.position?.name || ""}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">No reports.</p>
                      )}
                    </div>
                  ))}
                </div>
                {grouped.unassigned.length > 0 && (
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="font-medium text-sm">Unassigned</p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {grouped.unassigned.map((emp) => (
                        <li key={emp.employeeId} className="flex justify-between gap-2">
                          <span>
                            {emp.firstName} {emp.lastName} ({emp.employeeCode})
                          </span>
                          <span className="text-xs">{emp.position?.name || ""}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
