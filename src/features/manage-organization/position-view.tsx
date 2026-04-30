"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BriefcaseBusiness, ChevronDown, RefreshCcw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineLoadingState } from "@/components/loading/loading-states";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { loadPositionsData } from "@/features/manage-organization/organization-data-cache";

type PositionRecord = {
  positionId: string;
  name: string;
  isActive: boolean;
  description?: string | null;
  dailyRate: number | null;
  hourlyRate: number | null;
  monthlyRate: number | null;
  currencyCode: string;
  departmentId: string;
  department?: { departmentId: string; name: string } | null;
  employees: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    img?: string | null;
    department?: { name: string | null } | null;
  }[];
};

type PositionEmployee = PositionRecord["employees"][number];

function formatCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function getEmployeeInitials(employee: PositionEmployee) {
  return `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
}

function getEmployeeImageSrc(employee: PositionEmployee) {
  const image = employee.img?.trim();
  return image ? image : undefined;
}

export function PositionView({
  onInitialLoadComplete,
}: {
  onInitialLoadComplete?: () => void;
}) {
  const [data, setData] = useState<PositionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [activeDepartmentId, setActiveDepartmentId] = useState("all");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const hasReportedInitialLoadRef = useRef(false);

  const load = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError(null);
      const result = await loadPositionsData({ force });
      if (!result.success) {
        throw new Error(result.error || "Failed to load positions");
      }
      setData((result.data ?? []) as PositionRecord[]);
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

  const departments = useMemo(() => {
    const grouped = new Map<string, { departmentId: string; name: string; count: number }>();

    for (const position of data) {
      const departmentId = position.department?.departmentId ?? position.departmentId;
      const departmentName = position.department?.name ?? "Unassigned department";
      const current = grouped.get(departmentId);

      if (current) {
        current.count += 1;
        continue;
      }

      grouped.set(departmentId, {
        departmentId,
        name: departmentName,
        count: 1,
      });
    }

    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filteredPositions = useMemo(() => {
    const term = filter.trim().toLowerCase();

    return data.filter((position) => {
      if (
        activeDepartmentId !== "all" &&
        (position.department?.departmentId ?? position.departmentId) !== activeDepartmentId
      ) {
        return false;
      }

      if (!term) return true;

      const haystack = [
        position.name,
        position.description ?? "",
        position.department?.name ?? "",
        ...position.employees.map(
          (employee) =>
            `${employee.firstName} ${employee.lastName} ${employee.employeeCode}`,
        ),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [activeDepartmentId, data, filter]);

  const totals = useMemo(() => {
    const filledPositions = data.filter((position) => position.employees.length > 0).length;
    const assignedEmployees = data.reduce(
      (sum, position) => sum + position.employees.length,
      0,
    );

    return {
      positions: data.length,
      filledPositions,
      assignedEmployees,
    };
  }, [data]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg">Job/Position View</CardTitle>
            <p className="text-sm text-muted-foreground">
              Scan positions fast, then open each role inline to see full assigned team.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full min-w-0 lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Search position, department, or employee"
                className="pl-9"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => void load(true)} aria-label="Reload">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <BriefcaseBusiness className="h-4 w-4" />
              Positions
            </div>
            <p className="mt-2 text-xl font-semibold">{totals.positions}</p>
          </div>
          <div className="rounded-xl border bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Filled Positions
            </p>
            <p className="mt-2 text-xl font-semibold">{totals.filledPositions}</p>
          </div>
          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Users className="h-4 w-4" />
              Assigned Employees
            </div>
            <p className="mt-2 text-xl font-semibold">{totals.assignedEmployees}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {departments.length > 0 ? (
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Department filter
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <button
                type="button"
                onClick={() => setActiveDepartmentId("all")}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                  activeDepartmentId === "all"
                    ? "border-primary/40 bg-primary/15 text-foreground"
                    : "border-border bg-background/70 text-muted-foreground hover:bg-muted/50",
                )}
              >
                <span>All positions</span>
                <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px]">
                  {totals.positions}
                </span>
              </button>

              {departments.map((department) => (
                <button
                  key={department.departmentId}
                  type="button"
                  onClick={() => setActiveDepartmentId(department.departmentId)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                    activeDepartmentId === department.departmentId
                      ? "border-primary/40 bg-primary/15 text-foreground"
                      : "border-border bg-background/70 text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <span>{department.name}</span>
                  <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px]">
                    {department.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? (
          <InlineLoadingState label="Loading positions" lines={2} />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filteredPositions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No positions found.</p>
        ) : (
          <div className="space-y-3">
            {filteredPositions.map((position) => {
              const isOpen = !!openIds[position.positionId];
              const previewEmployees = position.employees.slice(0, 4);
              const extraEmployees = Math.max(position.employees.length - previewEmployees.length, 0);

              return (
                <Collapsible
                  key={position.positionId}
                  open={isOpen}
                  onOpenChange={(value) =>
                    setOpenIds((prev) => ({ ...prev, [position.positionId]: value }))
                  }
                  className="overflow-hidden rounded-xl border bg-card"
                >
                  <CollapsibleTrigger className="w-full p-0 text-left transition-colors hover:bg-muted/5">
                    <div className="space-y-4 p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold">{position.name}</span>
                          </div>
                          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                            {position.description || "No description added for this position yet."}
                          </p>
                        </div>

                        <div className="flex flex-col gap-3 xl:min-w-[320px] xl:items-end">
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
                                {position.employees.length > 0
                                  ? `${position.employees.length} assigned${extraEmployees > 0 ? `, +${extraEmployees} more` : ""}`
                                  : "No assigned employees"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {position.department?.name ?? "No department"}
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

                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Department
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {position.department?.name ?? "No department"}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Members
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {formatCount(position.employees.length, "member")}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Status
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {position.employees.length > 0 ? "Staffed" : "Open"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="border-t border-border/60 bg-muted/5 px-4 pb-4 pt-3">
                    <div className="grid gap-3">
                      <section className="space-y-4 rounded-lg border bg-background p-4">
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold">Assigned employees</p>
                              <Badge variant="outline" className="rounded-full px-2.5 py-0.5">
                                {formatCount(position.employees.length, "member")}
                              </Badge>
                            </div>

                            {position.employees.length === 0 ? (
                              <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                                No employees assigned to this position yet.
                              </div>
                            ) : (
                              <div className="overflow-hidden rounded-lg border">
                                {position.employees.map((employee) => (
                                  <div
                                    key={employee.employeeId}
                                    className="flex items-center gap-3 border-b bg-background px-3 py-3 last:border-b-0"
                                  >
                                    <Avatar className="h-10 w-10 shrink-0">
                                      {getEmployeeImageSrc(employee) ? (
                                        <AvatarImage
                                          src={getEmployeeImageSrc(employee)}
                                          alt={`${employee.firstName} ${employee.lastName}`}
                                        />
                                      ) : null}
                                      <AvatarFallback className="bg-primary/10 text-xs font-semibold uppercase text-primary">
                                        {getEmployeeInitials(employee)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium">
                                        {employee.firstName} {employee.lastName} · {employee.employeeCode}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {position.name}
                                      </p>
                                    </div>
                                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                                      {position.department?.name ?? employee.department?.name ?? "No department"}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
