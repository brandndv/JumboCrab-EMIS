"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Mail, Network, RefreshCcw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineLoadingState } from "@/components/loading/loading-states";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Background,
  BaseEdge,
  Position,
  ReactFlow,
  type EdgeProps,
  type Edge,
  type Node,
} from "@xyflow/react";
import { loadStructureData } from "@/features/manage-organization/organization-data-cache";

type SupervisorUser = {
  userId: string;
  username: string;
  email: string;
  role: string;
  img?: string | null;
};

type EmployeeRow = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  img?: string | null;
  supervisorUserId?: string | null;
  department?: { departmentId: string; name: string; isActive: boolean } | null;
  position?: { positionId: string; name: string; isActive: boolean } | null;
};

type SupervisorGroup = {
  supervisor: SupervisorUser;
  reports: EmployeeRow[];
};

type HierarchyLayout = {
  nodes: Node[];
  edges: Edge[];
  height: number;
};

const FIRST_BRANCH_Y = 110;

function OrgChartEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
}: EdgeProps) {
  const radius = 18;

  if (targetX === sourceX) {
    return <BaseEdge id={id} path={`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`} style={style} />;
  }

  const direction = targetX > sourceX ? 1 : -1;
  const firstTurnY = Math.max(sourceY, FIRST_BRANCH_Y - radius);
  const secondTurnY = FIRST_BRANCH_Y + radius;
  const horizontalEndX = targetX - direction * radius;
  const path = [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceX} ${firstTurnY}`,
    `Q ${sourceX} ${FIRST_BRANCH_Y} ${sourceX + direction * radius} ${FIRST_BRANCH_Y}`,
    `L ${horizontalEndX} ${FIRST_BRANCH_Y}`,
    `Q ${targetX} ${FIRST_BRANCH_Y} ${targetX} ${secondTurnY}`,
    `L ${targetX} ${targetY}`,
  ].join(" ");

  return <BaseEdge id={id} path={path} style={style} />;
}

function formatCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function getEmployeeInitials(employee: EmployeeRow) {
  return `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
}

function getSupervisorInitials(supervisor: SupervisorUser) {
  const parts = supervisor.username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return supervisor.username.slice(0, 2).toUpperCase();
  }

  return parts.map((part) => part.charAt(0)).join("").toUpperCase();
}

function buildHierarchyLayout(
  supervisor: SupervisorUser,
  reports: EmployeeRow[],
): HierarchyLayout {
  const columns = Math.min(Math.max(2, Math.ceil(Math.sqrt(Math.max(reports.length, 1)))), 4);
  const rowGap = 150;
  const colGap = 245;
  const rootWidth = 280;
  const childWidth = 220;

  const childNodes: Node[] = reports.map((employee, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);

    return {
      id: employee.employeeId,
      position: {
        x: col * colGap,
        y: 180 + row * rowGap,
      },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        label: (
          <div className="flex items-start gap-3 text-left">
            <Avatar className="h-10 w-10 shrink-0 border border-border/60">
              {employee.img ? (
                <AvatarImage
                  src={employee.img}
                  alt={`${employee.firstName} ${employee.lastName}`}
                />
              ) : null}
              <AvatarFallback className="bg-muted text-[10px] font-semibold uppercase text-foreground">
                {getEmployeeInitials(employee)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-medium">
                {employee.firstName} {employee.lastName}
              </div>
              <div className="text-[11px] text-muted-foreground">{employee.employeeCode}</div>
              <div className="pt-1 text-[11px] text-muted-foreground">
                {employee.position?.name || "No position"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {employee.department?.name || "No department"}
              </div>
            </div>
          </div>
        ),
      },
      style: {
        width: childWidth,
        borderRadius: 16,
        border: "1px solid var(--border)",
        background: "var(--background)",
        color: "var(--foreground)",
        padding: 12,
        boxShadow: "none",
      },
    };
  });

  const childCenters =
    childNodes.length > 0
      ? childNodes.map((node) => node.position.x + childWidth / 2)
      : [childWidth / 2];
  const minChildCenter = Math.min(...childCenters);
  const maxChildCenter = Math.max(...childCenters);
  const rootCenterX = (minChildCenter + maxChildCenter) / 2;

  const rootNode: Node = {
    id: `sup-${supervisor.userId}`,
    position: { x: rootCenterX - rootWidth / 2, y: 0 },
    draggable: false,
    selectable: false,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data: {
      label: (
        <div className="flex items-start gap-3 text-left">
          <Avatar className="h-11 w-11 shrink-0 border border-border/60">
            {supervisor.img ? (
              <AvatarImage src={supervisor.img} alt={supervisor.username} />
            ) : null}
            <AvatarFallback className="bg-muted text-xs font-semibold uppercase text-foreground">
              {getSupervisorInitials(supervisor)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <div className="text-sm font-semibold">{supervisor.username}</div>
            <div className="text-[11px] text-muted-foreground">{supervisor.role}</div>
            <div className="pt-1 text-[11px] text-muted-foreground">{supervisor.email}</div>
          </div>
        </div>
      ),
    },
    style: {
      width: rootWidth,
      borderRadius: 18,
      border: "1px solid var(--border)",
      background: "var(--card)",
      color: "var(--card-foreground)",
      padding: 14,
      boxShadow: "none",
    },
  };

  const edges: Edge[] = reports.map((employee) => ({
    id: `edge-${supervisor.userId}-${employee.employeeId}`,
    source: rootNode.id,
    target: employee.employeeId,
    type: "orgChart",
    animated: false,
    selectable: false,
    style: {
      stroke: "color-mix(in srgb, var(--foreground) 28%, transparent)",
      strokeWidth: 1.4,
      strokeOpacity: 0.8,
    },
  }));

  const rows = Math.max(1, Math.ceil(reports.length / columns));
  const height = Math.max(300, 220 + rows * rowGap);

  return {
    nodes: [rootNode, ...childNodes],
    edges,
    height,
  };
}

export function SupervisorView({
  onInitialLoadComplete,
}: {
  onInitialLoadComplete?: () => void;
}) {
  const edgeTypes = useMemo(() => ({ orgChart: OrgChartEdge }), []);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [groupsFromApi, setGroupsFromApi] = useState<SupervisorGroup[]>([]);
  const [unassignedFromApi, setUnassignedFromApi] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const hasReportedInitialLoadRef = useRef(false);

  const load = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError(null);
      const result = await loadStructureData({ force });
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

  const totals = useMemo(() => {
    const activeTeams = grouped.groups.filter((group) => group.reports.length > 0).length;
    const totalReports = grouped.groups.reduce((sum, group) => sum + group.reports.length, 0);

    return {
      supervisors: grouped.groups.length,
      activeTeams,
      unassignedEmployees: grouped.unassigned.length,
      totalReports,
    };
  }, [grouped.groups, grouped.unassigned.length]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg">Supervisor View</CardTitle>
            <p className="text-sm text-muted-foreground">
              Collapsible hierarchy tree from supervisor to subordinates.
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
            <Button variant="ghost" size="icon" onClick={() => void load(true)} aria-label="Reload">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border bg-muted/15 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Network className="h-4 w-4" />
              Supervisors
            </div>
            <p className="mt-2 text-2xl font-semibold">{totals.supervisors}</p>
          </div>
          <div className="rounded-2xl border bg-muted/15 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Active Teams
            </p>
            <p className="mt-2 text-2xl font-semibold">{totals.activeTeams}</p>
          </div>
          <div className="rounded-2xl border bg-muted/15 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Users className="h-4 w-4" />
              Total Reports
            </div>
            <p className="mt-2 text-2xl font-semibold">{totals.totalReports}</p>
          </div>
          <div className="rounded-2xl border bg-muted/15 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Unassigned
            </p>
            <p className="mt-2 text-2xl font-semibold">{totals.unassignedEmployees}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4">
        {loading ? (
          <InlineLoadingState label="Loading supervisors" lines={2} />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filteredGroups.length === 0 && grouped.unassigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data.</p>
        ) : (
          <>
            {grouped.unassigned.length > 0 ? (
              <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Unassigned Employees</p>
                    <p className="text-sm text-muted-foreground">
                      Reporting line still missing for these employees.
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit rounded-full px-3">
                    {formatCount(grouped.unassigned.length, "employee")}
                  </Badge>
                </div>
                <div className="border-t border-border/60 px-5 py-4">
                  <div className="flex flex-wrap gap-3">
                    {grouped.unassigned.slice(0, 8).map((employee) => (
                      <div
                        key={employee.employeeId}
                        className="inline-flex items-center gap-3 rounded-full border bg-background px-3 py-2"
                      >
                        <Avatar className="h-8 w-8 border border-border/60">
                          <AvatarFallback className="bg-muted text-[10px] font-semibold uppercase text-foreground">
                            {getEmployeeInitials(employee)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {employee.firstName} {employee.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {employee.employeeCode}
                          </p>
                        </div>
                      </div>
                    ))}
                    {grouped.unassigned.length > 8 ? (
                      <div className="inline-flex items-center rounded-full border border-dashed px-3 py-2 text-xs text-muted-foreground">
                        +{grouped.unassigned.length - 8} more
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            <div className="space-y-4">
              {filteredGroups.map(({ sup, reports }) => {
                const departmentNames = Array.from(
                  new Set(
                    reports
                      .map((employee) => employee.department?.name)
                      .filter((value): value is string => Boolean(value)),
                  ),
                );
                const layout = buildHierarchyLayout(sup, reports);
                const isOpen = !!openIds[sup.userId];

                return (
                  <Collapsible
                    key={sup.userId}
                    open={isOpen}
                    onOpenChange={(value) =>
                      setOpenIds((prev) => ({ ...prev, [sup.userId]: value }))
                    }
                    className="overflow-hidden rounded-2xl border border-border/70 bg-card"
                  >
                    <CollapsibleTrigger className="w-full p-0 text-left transition-colors hover:bg-muted/5">
                      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <Avatar className="h-12 w-12 border border-border/60">
                            {sup.img ? (
                              <AvatarImage src={sup.img} alt={sup.username} />
                            ) : null}
                            <AvatarFallback className="bg-muted text-sm font-semibold uppercase text-foreground">
                              {getSupervisorInitials(sup)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-lg font-semibold">{sup.username}</p>
                              <Badge variant="outline" className="rounded-full px-2.5 py-0.5">
                                {sup.role}
                              </Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-4 w-4" />
                              <span className="truncate">{sup.email}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <Badge variant="secondary" className="rounded-full px-3 py-1">
                            {formatCount(reports.length, "report")}
                          </Badge>
                          {departmentNames.length > 0 ? (
                            <Badge variant="outline" className="rounded-full px-3 py-1">
                              {formatCount(departmentNames.length, "department")}
                            </Badge>
                          ) : null}
                          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-foreground">
                            <span>{isOpen ? "Hide tree" : "View tree"}</span>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform",
                                isOpen ? "rotate-180" : "",
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="border-t border-border/60 bg-muted/5 px-4 pb-4 pt-3">
                      <div className="rounded-2xl border bg-background p-3">
                        {reports.length > 0 ? (
                          <div style={{ height: layout.height }}>
                            <ReactFlow
                              className="supervisor-hierarchy-flow"
                              nodes={layout.nodes}
                              edges={layout.edges}
                              edgeTypes={edgeTypes}
                              fitView
                              fitViewOptions={{ padding: 0.18 }}
                              nodesDraggable={false}
                              nodesConnectable={false}
                              elementsSelectable={false}
                              zoomOnDoubleClick={false}
                              proOptions={{ hideAttribution: true }}
                            >
                              <Background gap={20} size={1} color="var(--border)" />
                            </ReactFlow>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/60 bg-background px-4 py-10 text-center text-sm text-muted-foreground">
                            No direct reports assigned to this supervisor.
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
      <style jsx global>{`
        .supervisor-hierarchy-flow .react-flow__handle {
          opacity: 0;
          pointer-events: none;
        }
      `}</style>
    </Card>
  );
}
