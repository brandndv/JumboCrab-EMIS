"use client";

import { getOrganizationStructure } from "@/actions/organization/organization-structure-action";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  department?: { departmentId: string; name: string } | null;
  position?: { positionId: string; name: string } | null;
};

type SupervisorGroup = {
  supervisor: SupervisorUser;
  reports: EmployeeRow[];
};

export function SupervisorView() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [groupsFromApi, setGroupsFromApi] = useState<SupervisorGroup[]>([]);
  const [unassignedFromApi, setUnassignedFromApi] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<{ supId: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getOrganizationStructure();
      if (!result.success) {
        throw new Error(result.error || "Failed to load structure");
      }
      setEmployees(result.data ?? []);
      setSupervisors(result.supervisors ?? []);
      setGroupsFromApi(result.supervisorGroups ?? []);
      setUnassignedFromApi(result.unassigned ?? []);
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
    if (groupsFromApi.length || unassignedFromApi.length) {
      const normalizedGroups = groupsFromApi.map((g) => ({
        sup: g.supervisor,
        reports: g.reports ?? [],
      }));
      return { groups: normalizedGroups, unassigned: unassignedFromApi };
    }
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
  }, [employees, supervisors, groupsFromApi, unassignedFromApi]);

  const selectedGroup = useMemo(() => {
    if (!detailTarget) return null;
    return grouped.groups.find((g) => g.sup.userId === detailTarget.supId) || null;
  }, [grouped.groups, detailTarget]);

  const detailList = detailTarget ? selectedGroup?.reports ?? [] : [];

  const openDetails = (supId: string) => {
    setDetailTarget({ supId });
    setDetailOpen(true);
  };

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
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{reports.length} reports</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDetails(sup.userId)}
                          >
                            View
                          </Button>
                        </div>
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
              </>
            )}
          </>
        )}
      </CardContent>
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedGroup?.sup.username ?? "Supervisor"}
            </DialogTitle>
            <DialogDescription>
              {`${detailList.length} direct report${detailList.length === 1 ? "" : "s"}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {detailTarget && detailList.length > 0 ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {detailList.map((emp) => (
                  <li key={emp.employeeId} className="flex justify-between gap-2">
                    <span>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </span>
                    <span className="text-xs">{emp.position?.name || ""}</span>
                  </li>
                ))}
              </ul>
            ) : detailTarget ? (
              <p className="text-sm text-muted-foreground">No direct reports.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
