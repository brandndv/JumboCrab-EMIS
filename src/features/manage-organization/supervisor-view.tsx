"use client";

import { getOrganizationStructure } from "@/actions/organization/organization-structure-action";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network, RefreshCcw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineLoadingState } from "@/components/loading/loading-states";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  department?: { departmentId: string; name: string; isActive: boolean } | null;
  position?: { positionId: string; name: string; isActive: boolean } | null;
};

type SupervisorGroup = {
  supervisor: SupervisorUser;
  reports: EmployeeRow[];
};

export function SupervisorView({
  onInitialLoadComplete,
}: {
  onInitialLoadComplete?: () => void;
}) {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [groupsFromApi, setGroupsFromApi] = useState<SupervisorGroup[]>([]);
  const [unassignedFromApi, setUnassignedFromApi] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<{ supId: string } | null>(null);
  const [filter, setFilter] = useState("");
  const hasReportedInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
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
      if (!hasReportedInitialLoadRef.current) {
        hasReportedInitialLoadRef.current = true;
        onInitialLoadComplete?.();
      }
    }
  }, [onInitialLoadComplete]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    if (groupsFromApi.length || unassignedFromApi.length) {
      const normalizedGroups = groupsFromApi.map((group) => ({
        sup: group.supervisor,
        reports: group.reports ?? [],
      }));
      return { groups: normalizedGroups, unassigned: unassignedFromApi };
    }

    const map = new Map<string, { sup: SupervisorUser; reports: EmployeeRow[] }>();
    supervisors.forEach((supervisor) =>
      map.set(supervisor.userId, { sup: supervisor, reports: [] }),
    );

    const unassigned: EmployeeRow[] = [];
    employees.forEach((employee) => {
      if (employee.supervisorUserId && map.has(employee.supervisorUserId)) {
        map.get(employee.supervisorUserId)!.reports.push(employee);
      } else {
        unassigned.push(employee);
      }
    });

    return { groups: Array.from(map.values()), unassigned };
  }, [employees, supervisors, groupsFromApi, unassignedFromApi]);

  const filteredGroups = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return grouped.groups;

    return grouped.groups.filter(({ sup, reports }) => {
      const haystack = [
        sup.username,
        sup.role,
        ...reports.map(
          (employee) =>
            `${employee.firstName} ${employee.lastName} ${employee.employeeCode} ${
              employee.position?.name || ""
            } ${employee.department?.name || ""}`,
        ),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [filter, grouped.groups]);

  const selectedGroup = useMemo(() => {
    if (!detailTarget) return null;
    return filteredGroups.find((group) => group.sup.userId === detailTarget.supId) || null;
  }, [detailTarget, filteredGroups]);

  const detailList = detailTarget ? selectedGroup?.reports ?? [] : [];

  const totals = useMemo(() => {
    const supervisorsWithReports = grouped.groups.filter(
      (group) => group.reports.length > 0,
    ).length;

    return {
      supervisors: grouped.groups.length,
      supervisorsWithReports,
      unassignedEmployees: grouped.unassigned.length,
    };
  }, [grouped.groups, grouped.unassigned.length]);

  const openDetails = (supId: string) => {
    setDetailTarget({ supId });
    setDetailOpen(true);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg">Supervisor View</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review reporting lines quickly and spot teams that still need assignment.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full min-w-0 lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Search supervisor, report, role, or department"
                className="pl-9"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={load} aria-label="Reload">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/15 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Network className="h-4 w-4" />
              Supervisors
            </div>
            <p className="mt-2 text-2xl font-semibold">{totals.supervisors}</p>
          </div>
          <div className="rounded-xl border bg-muted/15 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Active Teams
            </p>
            <p className="mt-2 text-2xl font-semibold">{totals.supervisorsWithReports}</p>
          </div>
          <div className="rounded-xl border bg-muted/15 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Users className="h-4 w-4" />
              Unassigned Employees
            </div>
            <p className="mt-2 text-2xl font-semibold">{totals.unassignedEmployees}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {loading ? (
          <InlineLoadingState label="Loading supervisors" lines={2} />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filteredGroups.length === 0 && grouped.unassigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data.</p>
        ) : (
          <>
            {grouped.unassigned.length > 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Employees without supervisor</p>
                    <p className="text-sm text-muted-foreground">
                      These employees are not yet connected to a reporting line.
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit rounded-full px-3">
                    {grouped.unassigned.length} unassigned
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {grouped.unassigned.slice(0, 8).map((employee) => (
                    <span
                      key={employee.employeeId}
                      className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground"
                    >
                      {employee.firstName} {employee.lastName} ({employee.employeeCode})
                    </span>
                  ))}
                  {grouped.unassigned.length > 8 ? (
                    <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">
                      +{grouped.unassigned.length - 8} more
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              {filteredGroups.map(({ sup, reports }) => {
                const previewReports = reports.slice(0, 5);
                const departmentCount = new Set(
                  reports
                    .map((employee) => employee.department?.name)
                    .filter((value): value is string => Boolean(value)),
                ).size;

                return (
                  <div
                    key={sup.userId}
                    className="rounded-xl border bg-card/70 p-5 shadow-sm transition-colors hover:bg-muted/10"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <p className="text-xl font-semibold">{sup.username}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="rounded-full px-3">
                            {sup.role}
                          </Badge>
                          <Badge variant="outline" className="rounded-full px-3">
                            {reports.length} report{reports.length === 1 ? "" : "s"}
                          </Badge>
                          <Badge variant="outline" className="rounded-full px-3">
                            {departmentCount} department{departmentCount === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{sup.email}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openDetails(sup.userId)}
                      >
                        View reports
                      </Button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {previewReports.length > 0 ? (
                        <div className="space-y-2">
                          {previewReports.map((employee) => (
                            <div
                              key={employee.employeeId}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {employee.firstName} {employee.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {employee.employeeCode}
                                </p>
                              </div>
                              <div className="shrink-0 text-right text-xs text-muted-foreground">
                                <p>{employee.position?.name || "No position"}</p>
                                <p>{employee.department?.name || "No department"}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                          No direct reports assigned to this supervisor.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
            <DialogTitle>{selectedGroup?.sup.username ?? "Supervisor"}</DialogTitle>
            <DialogDescription>
              {`${detailList.length} direct report${detailList.length === 1 ? "" : "s"}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {detailTarget && detailList.length > 0 ? (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {detailList.map((employee) => (
                  <li
                    key={employee.employeeId}
                    className="flex items-center justify-between rounded-lg border px-3 py-3"
                  >
                    <span>
                      {employee.firstName} {employee.lastName} ({employee.employeeCode})
                    </span>
                    <span className="text-xs">
                      {employee.position?.name || "No position"}
                    </span>
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
