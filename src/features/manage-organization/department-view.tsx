"use client";

import { listDepartments } from "@/actions/organization/departments-action";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

export function DepartmentView() {
  const [data, setData] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Dept | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const load = async () => {
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
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Department View</CardTitle>
          <p className="text-sm text-muted-foreground">
            See departments, roles in each, and assigned employees.
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
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No departments found.</p>
        ) : (
          <div className="space-y-3">
            {data.map((dept) => {
              const isOpen = !!openIds[dept.departmentId];
              return (
                <Collapsible
                  key={dept.departmentId}
                  open={isOpen}
                  onOpenChange={(val) =>
                    setOpenIds((prev) => ({ ...prev, [dept.departmentId]: val }))
                  }
                  className="border rounded-lg px-3"
                >
                  <CollapsibleTrigger className="w-full py-3 text-left">
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{dept.name}</span>
                        <Badge variant="secondary">
                          {dept.positions.length} role{dept.positions.length === 1 ? "" : "s"}
                        </Badge>
                        <Badge variant="outline">
                          {dept.employees.length} employee{dept.employees.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      {dept.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {dept.description}
                        </span>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pb-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
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
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Roles</p>
                      {dept.positions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No roles in this department.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {dept.positions.map((pos) => (
                            <div key={pos.positionId} className="rounded-md border bg-muted/20 px-3 py-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{pos.name}</span>
                                <Badge variant="outline">
                                  {pos.employees.length} assigned
                                </Badge>
                              </div>
                              {pos.employees.length > 0 && (
                                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                                  {pos.employees.map((emp) => (
                                    <li key={emp.employeeId}>
                                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Employees</p>
                      {dept.employees.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No employees in this department.</p>
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {dept.employees.map((emp) => (
                            <li key={emp.employeeId} className="flex items-center justify-between rounded-md border px-3 py-2">
                              <span>
                                {emp.firstName} {emp.lastName} ({emp.employeeCode})
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {emp.position?.name || "No position"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
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
        onOpenChange={(val) => {
          setIsDialogOpen(val);
          if (!val) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name ?? "Department"}</DialogTitle>
            <DialogDescription>
              Snapshot of roles and employees in this department.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Description</p>
              <p className="font-medium">{selected?.description || "None"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Roles</p>
              {selected?.positions?.length ? (
                <ul className="mt-1 space-y-1">
                  {selected.positions.map((p) => (
                    <li key={p.positionId} className="flex items-center justify-between rounded-md border px-3 py-2">
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
              <p className="text-muted-foreground">Employees</p>
              {selected?.employees?.length ? (
                <ul className="mt-1 space-y-1">
                  {selected.employees.map((e) => (
                    <li key={e.employeeId} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span>{e.firstName} {e.lastName} ({e.employeeCode})</span>
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
