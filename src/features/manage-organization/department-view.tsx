"use client";

import { listDepartments } from "@/actions/organization/departments-action";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BriefcaseBusiness,
  ChevronDown,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineLoadingState } from "@/components/loading/loading-states";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Dept = {
  departmentId: string;
  name: string;
  description?: string | null;
  positions: {
    positionId: string;
    name: string;
    employees: {
      employeeId: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
    }[];
  }[];
  employees: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    position?: { name: string | null; positionId: string | null } | null;
  }[];
};

export function DepartmentView({
  onInitialLoadComplete,
}: {
  onInitialLoadComplete?: () => void;
}) {
  const [data, setData] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Dept | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const hasReportedInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listDepartments();
      if (!result.success) {
        throw new Error(result.error || "Failed to load departments");
      }
      setData(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load departments");
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

  const filteredDepartments = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return data;

    return data.filter((dept) => {
      const haystack = [
        dept.name,
        dept.description ?? "",
        ...dept.positions.map((position) => position.name),
        ...dept.employees.map(
          (employee) =>
            `${employee.firstName} ${employee.lastName} ${employee.employeeCode}`,
        ),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [data, filter]);

  const totals = useMemo(() => {
    const roleCount = data.reduce((sum, dept) => sum + dept.positions.length, 0);
    const employeeCount = data.reduce(
      (sum, dept) => sum + dept.employees.length,
      0,
    );

    return {
      departments: data.length,
      roles: roleCount,
      employees: employeeCount,
    };
  }, [data]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg">Department View</CardTitle>
            <p className="text-sm text-muted-foreground">
              Browse departments, staffing levels, and role coverage in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full min-w-0 lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Search department, role, or employee"
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
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Departments
            </p>
            <p className="mt-2 text-2xl font-semibold">{totals.departments}</p>
          </div>
          <div className="rounded-xl border bg-muted/15 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <BriefcaseBusiness className="h-4 w-4" />
              Roles
            </div>
            <p className="mt-2 text-2xl font-semibold">{totals.roles}</p>
          </div>
          <div className="rounded-xl border bg-muted/15 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Users className="h-4 w-4" />
              Employees
            </div>
            <p className="mt-2 text-2xl font-semibold">{totals.employees}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {loading ? (
          <InlineLoadingState label="Loading departments" lines={2} />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filteredDepartments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No departments found.</p>
        ) : (
          <div className="space-y-3">
            {filteredDepartments.map((dept) => {
              const isOpen = !!openIds[dept.departmentId];
              const previewEmployees = dept.employees.slice(0, 4);

              return (
                <Collapsible
                  key={dept.departmentId}
                  open={isOpen}
                  onOpenChange={(value) =>
                    setOpenIds((prev) => ({ ...prev, [dept.departmentId]: value }))
                  }
                  className="overflow-hidden rounded-xl border bg-card/60"
                >
                  <CollapsibleTrigger className="w-full p-4 text-left transition-colors hover:bg-muted/10">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-semibold">{dept.name}</span>
                          <Badge variant="secondary" className="rounded-full px-3">
                            {dept.positions.length} role
                            {dept.positions.length === 1 ? "" : "s"}
                          </Badge>
                          <Badge variant="outline" className="rounded-full px-3">
                            {dept.employees.length} employee
                            {dept.employees.length === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        {dept.description ? (
                          <p className="max-w-3xl text-sm text-muted-foreground">
                            {dept.description}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {dept.positions.slice(0, 5).map((position) => (
                            <Badge
                              key={position.positionId}
                              variant="secondary"
                              className="rounded-full bg-secondary/60 px-3 py-1"
                            >
                              {position.name}
                            </Badge>
                          ))}
                          {dept.positions.length > 5 ? (
                            <Badge variant="outline" className="rounded-full px-3 py-1">
                              +{dept.positions.length - 5} more
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-start gap-3 lg:items-end">
                        <div className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                          {isOpen ? "Hide details" : "View details"}
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </div>

                    {previewEmployees.length > 0 ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {previewEmployees.map((employee) => (
                          <div
                            key={employee.employeeId}
                            className="rounded-lg border border-border/60 bg-background/50 px-3 py-2"
                          >
                            <p className="text-sm font-medium">
                              {employee.firstName} {employee.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {employee.employeeCode}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {employee.position?.name || "No position assigned"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CollapsibleTrigger>

                  <CollapsibleContent className="border-t border-border/60 bg-muted/5 p-4">
                    <div className="grid gap-4 xl:grid-cols-[1.05fr_1.2fr]">
                      <section className="space-y-3 rounded-xl border bg-background/60 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Roles in this department</p>
                          <Badge variant="outline" className="rounded-full px-3">
                            {dept.positions.length}
                          </Badge>
                        </div>
                        {dept.positions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No roles in this department yet.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {dept.positions.map((pos) => (
                              <div
                                key={pos.positionId}
                                className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-medium">{pos.name}</span>
                                  <Badge variant="outline" className="rounded-full px-3">
                                    {pos.employees.length} assigned
                                  </Badge>
                                </div>
                                {pos.employees.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {pos.employees.slice(0, 4).map((emp) => (
                                      <span
                                        key={emp.employeeId}
                                        className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                                      >
                                        {emp.firstName} {emp.lastName}
                                      </span>
                                    ))}
                                    {pos.employees.length > 4 ? (
                                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                                        +{pos.employees.length - 4} more
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="space-y-3 rounded-xl border bg-background/60 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Employees</p>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelected(dept);
                              setIsDialogOpen(true);
                            }}
                          >
                            Quick view
                          </Button>
                        </div>
                        {dept.employees.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No employees in this department.
                          </p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {dept.employees.map((emp) => (
                              <div
                                key={emp.employeeId}
                                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {emp.firstName} {emp.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {emp.employeeCode}
                                  </p>
                                </div>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {emp.position?.name || "No position"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(value) => {
          setIsDialogOpen(value);
          if (!value) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name ?? "Department"}</DialogTitle>
            <DialogDescription>
              Snapshot of roles and employees in this department.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Description
              </p>
              <p className="mt-2 font-medium">{selected?.description || "None"}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Roles</p>
              {selected?.positions?.length ? (
                <ul className="space-y-2">
                  {selected.positions.map((p) => (
                    <li
                      key={p.positionId}
                      className="flex items-center justify-between rounded-lg border px-3 py-3"
                    >
                      <span>{p.name}</span>
                      <Badge variant="outline">{p.employees.length} assigned</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No roles yet.</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Employees</p>
              {selected?.employees?.length ? (
                <ul className="space-y-2">
                  {selected.employees.map((e) => (
                    <li
                      key={e.employeeId}
                      className="flex items-center justify-between rounded-lg border px-3 py-3"
                    >
                      <span>
                        {e.firstName} {e.lastName} ({e.employeeCode})
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {e.position?.name || "No position"}
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
