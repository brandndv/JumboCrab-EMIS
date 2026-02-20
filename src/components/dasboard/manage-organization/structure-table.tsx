"use client";

import {
  getOrganizationStructure,
  updateEmployeeSupervisor,
} from "@/actions/organization/organization-structure-action";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { RefreshCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type StructureRow = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  supervisorUserId?: string | null;
  role?: string | null;
  department?: { departmentId: string; name: string } | null;
  position?: { positionId: string; name: string } | null;
};

export function StructureTable() {
  const [rows, setRows] = useState<StructureRow[]>([]);
  const [supervisors, setSupervisors] = useState<
    { userId: string; username: string; email: string; role: string }[]
  >([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [target, setTarget] = useState<StructureRow | null>(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [positionFilter, setPositionFilter] = useState<string>("");
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getOrganizationStructure();
      if (!result.success) {
        throw new Error(result.error || "Failed to load structure");
      }
      setRows(result.data ?? []);
      setSupervisors(result.supervisors ?? []);
    } catch (err) {
      console.error("Structure fetch failed", err);
      setError(err instanceof Error ? err.message : "Failed to load structure");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return rows.filter((row) => {
      const fullName = `${row.firstName} ${row.lastName}`.toLowerCase();
      const dept = row.department?.name?.toLowerCase() || "";
      const pos = row.position?.name?.toLowerCase() || "";
      const supUser = supervisors.find((s) => s.userId === row.supervisorUserId);
      const sup = supUser?.username?.toLowerCase() || "";
      const deptMatch = deptFilter ? row.department?.departmentId === deptFilter : true;
      const posMatch = positionFilter ? row.position?.positionId === positionFilter : true;
      const unassignedMatch = showUnassignedOnly ? !row.supervisorUserId : true;
      const textMatch =
        !term ||
        fullName.includes(term) ||
        row.employeeCode.toLowerCase().includes(term) ||
        dept.includes(term) ||
        pos.includes(term) ||
        sup.includes(term);
      return textMatch && deptMatch && posMatch && unassignedMatch;
    });
  }, [rows, filter, deptFilter, positionFilter, showUnassignedOnly]);

  const deptOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.department?.departmentId) map.set(r.department.departmentId, r.department.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const positionOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.position?.positionId) map.set(r.position.positionId, r.position.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const unassignedRows = useMemo(() => rows.filter((r) => !r.supervisorUserId), [rows]);

  const openAssign = (row: StructureRow) => {
    setTarget(row);
    setSelectedSupervisor(row.supervisorUserId ?? "");
    setFormError(null);
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!target) return;
    try {
      setSaving(true);
      setFormError(null);
      const result = await updateEmployeeSupervisor({
        employeeId: target.employeeId,
        supervisorUserId: selectedSupervisor || null,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to update supervisor");
      }
      await load();
      setAssignOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update supervisor");
    } finally {
      setSaving(false);
    }
  };

  const eligibleSupervisors = useMemo(() => {
    const allowedRole = ["supervisor", "manager", "generalmanager", "admin"];
    return supervisors.filter((s) => allowedRole.includes((s.role ?? "").toLowerCase()));
  }, [supervisors]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Structure</CardTitle>
          <p className="text-sm text-muted-foreground">
            See who reports to whom. Edit supervisor assignments next.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Input
              placeholder="Search by name, code, department, supervisor"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full sm:w-72"
            />
            <div className="flex items-center gap-2">
              <Button
                variant={showUnassignedOnly ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowUnassignedOnly((prev) => !prev)}
                disabled={loading}
                className="whitespace-nowrap"
              >
                {showUnassignedOnly ? "Clear unassigned filter" : "Unassigned only"}{" "}
                <Badge variant="secondary" className="ml-2">{unassignedRows.length}</Badge>
              </Button>
              <select
                className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="">All departments</option>
                {deptOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
              >
                <option value="">All positions</option>
                {positionOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button variant="ghost" size="icon" onClick={load} aria-label="Reload structure">
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {deptFilter && <span className="rounded-full bg-muted px-3 py-1">Department filter on</span>}
            {positionFilter && <span className="rounded-full bg-muted px-3 py-1">Position filter on</span>}
            {showUnassignedOnly && <span className="rounded-full bg-muted px-3 py-1">Unassigned filter on</span>}
            {!deptFilter && !positionFilter && (
              <span className="rounded-full bg-muted px-3 py-1">All departments/positions</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {error && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    No matches found.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                !error &&
                filtered.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{row.firstName} {row.lastName}</span>
                        <span className="text-xs text-muted-foreground">{row.employeeCode}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.department?.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.position?.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(() => {
                        const sup = supervisors.find(
                          (s) => s.userId === row.supervisorUserId
                        );
                        return sup ? `${sup.username} (${sup.role})` : "Unassigned";
                      })()}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openAssign(row)}>
                        Assign
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Supervisor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {target
                ? `Set supervisor for ${target.firstName} ${target.lastName} (${target.employeeCode})`
                : "Select an employee"}
            </div>
            <div>
              <Label htmlFor="supervisor">Supervisor</Label>
              <select
                id="supervisor"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
              >
                <option value="">Unassigned</option>
                {eligibleSupervisors.map((sup) => (
                  <option key={sup.userId} value={sup.userId}>
                    {sup.username} ({sup.role})
                  </option>
                ))}
              </select>
              {!eligibleSupervisors.length && (
                <p className="text-xs text-muted-foreground mt-1">
                  No eligible supervisors found. Ensure a user exists with a supervisor/manager role.
                </p>
              )}
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleAssign} disabled={saving || !target}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
