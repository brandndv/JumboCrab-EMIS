"use client";

import {
  getOrganizationStructure,
  updateEmployeesSupervisorBulk,
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
import { TableLoadingState } from "@/components/loading/loading-states";

type StructureRow = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  supervisorUserId?: string | null;
  role?: string | null;
  department?: { departmentId: string; name: string; isActive: boolean } | null;
  position?: { positionId: string; name: string; isActive: boolean } | null;
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
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkSupervisorId, setBulkSupervisorId] = useState<string>("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getOrganizationStructure();
      if (!result.success) {
        throw new Error(result.error || "Failed to load structure");
      }
      const nextRows = result.data ?? [];
      setRows(nextRows);
      setSelectedEmployeeIds((prev) =>
        prev.filter((id) => nextRows.some((row) => row.employeeId === id)),
      );
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
  }, [rows, supervisors, filter, deptFilter, positionFilter, showUnassignedOnly]);

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
      if (r.position?.positionId && r.position.isActive) {
        map.set(r.position.positionId, r.position.name);
      }
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

  const selectedCount = selectedEmployeeIds.length;
  const filteredIds = filtered.map((row) => row.employeeId);
  const allFilteredSelected =
    filteredIds.length > 0 &&
    filteredIds.every((id) => selectedEmployeeIds.includes(id));

  const toggleSelectedEmployee = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds((prev) =>
      checked
        ? prev.includes(employeeId)
          ? prev
          : [...prev, employeeId]
        : prev.filter((id) => id !== employeeId),
    );
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    setSelectedEmployeeIds((prev) => {
      if (checked) {
        const merged = new Set([...prev, ...filteredIds]);
        return Array.from(merged);
      }
      const filteredIdSet = new Set(filteredIds);
      return prev.filter((id) => !filteredIdSet.has(id));
    });
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

  const handleBulkAssign = async () => {
    if (selectedEmployeeIds.length === 0) {
      setBulkError("Select at least one employee");
      return;
    }
    try {
      setBulkSaving(true);
      setBulkError(null);
      const result = await updateEmployeesSupervisorBulk({
        employeeIds: selectedEmployeeIds,
        supervisorUserId: bulkSupervisorId || null,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to update supervisors");
      }
      await load();
      setSelectedEmployeeIds([]);
      setBulkAssignOpen(false);
    } catch (err) {
      setBulkError(
        err instanceof Error ? err.message : "Failed to update supervisors",
      );
    } finally {
      setBulkSaving(false);
    }
  };

  const eligibleSupervisors = useMemo(() => {
    const allowedRole = ["supervisor", "manager", "generalmanager", "admin"];
    return supervisors.filter((s) => allowedRole.includes((s.role ?? "").toLowerCase()));
  }, [supervisors]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-4">
        <div className="max-w-2xl">
          <CardTitle className="text-lg">Structure</CardTitle>
          <p className="text-sm text-muted-foreground">
            See who reports to whom. Edit supervisor assignments next.
          </p>
        </div>
        <div className="rounded-lg border bg-muted/10 p-3">
          <div className="space-y-3">
            <Input
              placeholder="Search by name, code, department, supervisor"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full"
            />
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[220px_220px_220px_44px_180px_170px]">
              <Button
                variant={showUnassignedOnly ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowUnassignedOnly((prev) => !prev)}
                disabled={loading}
                className="w-full justify-between"
              >
                <span>Unassigned only</span>
                <Badge variant="secondary" className="ml-2 min-w-7 justify-center tabular-nums">
                  {unassignedRows.length}
                </Badge>
              </Button>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void load()}
                aria-label="Reload structure"
                className="h-10 w-10"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={selectedCount === 0}
                onClick={() => {
                  setBulkSupervisorId("");
                  setBulkError(null);
                  setBulkAssignOpen(true);
                }}
                className="w-full justify-between"
              >
                <span>Bulk Assign</span>
                <Badge variant="secondary" className="ml-2 min-w-7 justify-center tabular-nums">
                  {selectedCount}
                </Badge>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedEmployeeIds([])}
                disabled={selectedCount === 0}
                className="w-full"
              >
                Clear Selection
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {deptFilter && <span className="rounded-full bg-muted px-3 py-1">Department filter on</span>}
            {positionFilter && <span className="rounded-full bg-muted px-3 py-1">Position filter on</span>}
            {showUnassignedOnly && <span className="rounded-full bg-muted px-3 py-1">Unassigned filter on</span>}
            <span className="rounded-full bg-muted px-3 py-1">Selected {selectedCount}</span>
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
                <TableHead className="w-[44px]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-border"
                    checked={allFilteredSelected}
                    onChange={(event) =>
                      toggleSelectAllFiltered(event.currentTarget.checked)
                    }
                    aria-label="Select all visible employees"
                  />
                </TableHead>
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
                  <TableCell colSpan={6} className="p-3">
                    <TableLoadingState
                      label="Loading organization structure"
                      columns={6}
                      rows={3}
                    />
                  </TableCell>
                </TableRow>
              )}
              {error && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    No matches found.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                !error &&
                filtered.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border border-border"
                        checked={selectedEmployeeIds.includes(row.employeeId)}
                        onChange={(event) =>
                          toggleSelectedEmployee(
                            row.employeeId,
                            event.currentTarget.checked,
                          )
                        }
                        aria-label={`Select ${row.firstName} ${row.lastName}`}
                      />
                    </TableCell>
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
                      {!row.position ? (
                        "—"
                      ) : row.position.isActive ? (
                        row.position.name
                      ) : (
                        <Badge variant="outline">Archived position</Badge>
                      )}
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
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Assign Supervisor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Assign one supervisor to {selectedCount} selected employee
              {selectedCount === 1 ? "" : "s"}.
            </div>
            <div>
              <Label htmlFor="bulk-supervisor">Supervisor</Label>
              <select
                id="bulk-supervisor"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={bulkSupervisorId}
                onChange={(e) => setBulkSupervisorId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {eligibleSupervisors.map((sup) => (
                  <option key={sup.userId} value={sup.userId}>
                    {sup.username} ({sup.role})
                  </option>
                ))}
              </select>
            </div>
            {bulkError && <p className="text-sm text-destructive">{bulkError}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleBulkAssign} disabled={bulkSaving || selectedCount === 0}>
              {bulkSaving ? "Saving..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
