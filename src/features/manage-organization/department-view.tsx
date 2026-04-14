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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
      img?: string | null;
    }[];
  }[];
  employees: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    img?: string | null;
    position?: { name: string | null; positionId: string | null } | null;
  }[];
};

type DepartmentEmployee = Dept["employees"][number];

function formatCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function getEmployeeInitials(employee: DepartmentEmployee) {
  return `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
}

function getEmployeeImageSrc(employee: DepartmentEmployee) {
  const image = employee.img?.trim();
  return image ? image : undefined;
}

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
          <div className="rounded-xl border bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Departments
            </p>
            <p className="mt-2 text-xl font-semibold">{totals.departments}</p>
          </div>
          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <BriefcaseBusiness className="h-4 w-4" />
              Roles
            </div>
            <p className="mt-2 text-xl font-semibold">{totals.roles}</p>
          </div>
          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Users className="h-4 w-4" />
              Employees
            </div>
            <p className="mt-2 text-xl font-semibold">{totals.employees}</p>
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
              const previewPositions = dept.positions.slice(0, 5);
              const filledRoles = dept.positions.filter(
                (position) => position.employees.length > 0,
              ).length;

              return (
                <Collapsible
                  key={dept.departmentId}
                  open={isOpen}
                  onOpenChange={(value) =>
                    setOpenIds((prev) => ({ ...prev, [dept.departmentId]: value }))
                  }
                  className="overflow-hidden rounded-xl border bg-card"
                >
                  <CollapsibleTrigger className="w-full p-0 text-left transition-colors hover:bg-muted/5">
                    <div className="space-y-4 p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold">{dept.name}</span>
                            <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                              {formatCount(dept.positions.length, "role")}
                            </Badge>
                            <Badge variant="outline" className="rounded-full px-2.5 py-0.5">
                              {formatCount(dept.employees.length, "employee")}
                            </Badge>
                          </div>
                          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                            {dept.description || "No description added for this department yet."}
                          </p>
                          {previewPositions.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {previewPositions.map((position) => (
                                <Badge
                                  key={position.positionId}
                                  variant="secondary"
                                  className="rounded-full px-2.5 py-0.5"
                                >
                                  {position.name}
                                </Badge>
                              ))}
                              {dept.positions.length > previewPositions.length ? (
                                <Badge variant="outline" className="rounded-full px-2.5 py-0.5">
                                  +{dept.positions.length - previewPositions.length} more
                                </Badge>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No roles are assigned to this department yet.
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-3 xl:min-w-[280px] xl:items-end">
                          <div className="flex items-center gap-3">
                            {previewEmployees.length > 0 ? (
                              <div className="hidden sm:flex -space-x-2">
                                {previewEmployees.map((employee) => (
                                  <Avatar
                                    key={employee.employeeId}
                                    className="h-8 w-8 border-2 border-background"
                                  >
                                    {getEmployeeImageSrc(employee) ? (
                                      <AvatarImage
                                        src={getEmployeeImageSrc(employee)}
                                        alt={`${employee.firstName} ${employee.lastName}`}
                                      />
                                    ) : null}
                                    <AvatarFallback className="bg-primary/10 text-[11px] font-semibold uppercase text-primary">
                                      {getEmployeeInitials(employee)}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                              </div>
                            ) : null}
                            <div className="text-left xl:text-right">
                              <p className="text-sm font-medium">
                                {formatCount(dept.employees.length, "member")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatCount(filledRoles, "staffed role")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-foreground">
                              <span>{isOpen ? "Hide details" : "View details"}</span>
                              <ChevronDown
                                className={`h-4 w-4 text-muted-foreground transition-transform ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </div>

                          {previewEmployees.length > 0 ? (
                            <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                              {previewEmployees.map((employee) => (
                                <div
                                  key={employee.employeeId}
                                  className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-2.5 py-1"
                                >
                                  <Avatar className="h-6 w-6">
                                    {getEmployeeImageSrc(employee) ? (
                                      <AvatarImage
                                        src={getEmployeeImageSrc(employee)}
                                        alt={`${employee.firstName} ${employee.lastName}`}
                                      />
                                    ) : null}
                                    <AvatarFallback className="bg-primary/10 text-[10px] font-semibold uppercase text-primary">
                                      {getEmployeeInitials(employee)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="max-w-[140px] truncate text-xs text-foreground">
                                    {employee.firstName} {employee.lastName}
                                  </span>
                                </div>
                              ))}
                              {dept.employees.length > previewEmployees.length ? (
                                <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                                  +{dept.employees.length - previewEmployees.length} more
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No employees are currently assigned.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Roles
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {formatCount(dept.positions.length, "position")}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Filled
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {formatCount(filledRoles, "role")}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Team size
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {formatCount(dept.employees.length, "member")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="border-t border-border/60 bg-muted/5 px-4 pb-4 pt-3">
                    <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
                      <section className="space-y-3 rounded-lg border bg-background p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Roles in this department</p>
                          <Badge variant="outline" className="rounded-full px-3">
                            {formatCount(dept.positions.length, "role")}
                          </Badge>
                        </div>
                        {dept.positions.length === 0 ? (
                          <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                            No roles in this department yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {dept.positions.map((pos) => (
                              <div
                                key={pos.positionId}
                                className="rounded-lg border border-border/60 px-3 py-2.5"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-sm font-medium">{pos.name}</span>
                                  <Badge variant="outline" className="w-fit rounded-full px-3">
                                    {formatCount(pos.employees.length, "assigned employee")}
                                  </Badge>
                                </div>
                                {pos.employees.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {pos.employees.slice(0, 4).map((emp) => (
                                      <span
                                        key={emp.employeeId}
                                        className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"
                                      >
                                        {emp.firstName} {emp.lastName}
                                      </span>
                                    ))}
                                    {pos.employees.length > 4 ? (
                                      <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
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

                      <section className="space-y-3 rounded-lg border bg-background p-4">
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
                          <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                            No employees in this department.
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-lg border">
                            {dept.employees.map((emp) => (
                              <div
                                key={emp.employeeId}
                                className="flex items-center gap-3 border-b bg-background px-3 py-3 last:border-b-0"
                              >
                                <Avatar className="h-10 w-10 shrink-0">
                                  {getEmployeeImageSrc(emp) ? (
                                    <AvatarImage
                                      src={getEmployeeImageSrc(emp)}
                                      alt={`${emp.firstName} ${emp.lastName}`}
                                    />
                                  ) : null}
                                  <AvatarFallback className="bg-primary/10 text-xs font-semibold uppercase text-primary">
                                    {getEmployeeInitials(emp)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {emp.firstName} {emp.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {emp.employeeCode}
                                  </p>
                                </div>
                                <span className="shrink-0 text-right text-xs text-muted-foreground">
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
