"use client";

import { listPositions } from "@/actions/organization/positions-action";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BriefcaseBusiness, RefreshCcw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineLoadingState } from "@/components/loading/loading-states";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PositionRow = {
  positionId: string;
  name: string;
  description?: string | null;
  department?: { departmentId: string; name: string } | null;
  employees: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null } | null;
  }[];
};

export function PositionView({
  onInitialLoadComplete,
}: {
  onInitialLoadComplete?: () => void;
}) {
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [filter, setFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PositionRow | null>(null);
  const [open, setOpen] = useState(false);
  const hasReportedInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listPositions();
      if (!result.success) {
        throw new Error(result.error || "Failed to load positions");
      }
      setPositions(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load positions");
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

  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          positions
            .map((position) => position.department?.name)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [positions],
  );

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();

    return positions.filter((position) => {
      const matchesDepartment = departmentFilter
        ? position.department?.name === departmentFilter
        : true;

      if (!matchesDepartment) {
        return false;
      }

      if (!term) {
        return true;
      }

      return (
        position.name.toLowerCase().includes(term) ||
        position.department?.name?.toLowerCase().includes(term) ||
        position.description?.toLowerCase().includes(term) ||
        position.employees.some((employee) =>
          `${employee.firstName} ${employee.lastName} ${employee.employeeCode}`
            .toLowerCase()
            .includes(term),
        )
      );
    });
  }, [departmentFilter, filter, positions]);

  const totals = useMemo(() => {
    const assignedEmployees = positions.reduce(
      (sum, position) => sum + position.employees.length,
      0,
    );
    const filledPositions = positions.filter((position) => position.employees.length > 0).length;

    return {
      positions: positions.length,
      filledPositions,
      assignedEmployees,
    };
  }, [positions]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg">Job/Position View</CardTitle>
            <p className="text-sm text-muted-foreground">
              See which positions are staffed, who holds them, and where the coverage sits.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full min-w-0 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search position, department, or employee"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className="h-10 min-w-48 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="icon" onClick={load} aria-label="Reload">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/15 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <BriefcaseBusiness className="h-4 w-4" />
              Positions
            </div>
            <p className="mt-2 text-2xl font-semibold">{totals.positions}</p>
          </div>
          <div className="rounded-xl border bg-muted/15 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Filled Positions
            </p>
            <p className="mt-2 text-2xl font-semibold">{totals.filledPositions}</p>
          </div>
          <div className="rounded-xl border bg-muted/15 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Users className="h-4 w-4" />
              Assigned Employees
            </div>
            <p className="mt-2 text-2xl font-semibold">{totals.assignedEmployees}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {loading ? (
          <InlineLoadingState label="Loading positions" lines={2} />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No positions found.</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filtered.map((position) => {
              const previewEmployees = position.employees.slice(0, 4);

              return (
                <div
                  key={position.positionId}
                  className="rounded-xl border bg-card/70 p-5 shadow-sm transition-colors hover:bg-muted/10"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xl font-semibold">{position.name}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="rounded-full px-3">
                            {position.department?.name || "No department"}
                          </Badge>
                          <Badge variant="outline" className="rounded-full px-3">
                            {position.employees.length} assigned
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {position.description || "No description provided for this role yet."}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelected(position);
                        setOpen(true);
                      }}
                    >
                      View details
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Assigned employees</p>
                      {position.employees.length > previewEmployees.length ? (
                        <span className="text-xs text-muted-foreground">
                          +{position.employees.length - previewEmployees.length} more in details
                        </span>
                      ) : null}
                    </div>
                    {previewEmployees.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {previewEmployees.map((employee) => (
                          <div
                            key={employee.employeeId}
                            className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3"
                          >
                            <p className="text-sm font-medium">
                              {employee.firstName} {employee.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {employee.employeeCode}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {employee.department?.name || position.department?.name || ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                        No employees assigned to this position yet.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name ?? "Position"}</DialogTitle>
            <DialogDescription>Role details and assigned employees.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Department
                </p>
                <p className="mt-2 font-medium">
                  {selected?.department?.name || "None"}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Assigned
                </p>
                <p className="mt-2 font-medium">
                  {selected?.employees.length ?? 0} employee
                  {(selected?.employees.length ?? 0) === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Description
              </p>
              <p className="mt-2 font-medium">{selected?.description || "None"}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Employees</p>
              {selected?.employees?.length ? (
                <ul className="space-y-2">
                  {selected.employees.map((employee) => (
                    <li
                      key={employee.employeeId}
                      className="flex items-center justify-between rounded-lg border px-3 py-3"
                    >
                      <span>
                        {employee.firstName} {employee.lastName} ({employee.employeeCode})
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {employee.department?.name || ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No employees yet.</p>
              )}
            </div>
          </div>
          <DialogFooter />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
