"use client";

import { listDepartmentOptions } from "@/actions/organization/departments-action";
import {
  archivePosition,
  createPosition,
  listPositions,
  unarchivePosition,
  updatePosition,
} from "@/actions/organization/positions-action";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Archive, Eye, EyeOff, Pencil, Plus, RefreshCcw, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TableLoadingState } from "@/components/loading/loading-states";
import { useToast } from "@/components/ui/toast-provider";

type PositionRow = {
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
};

export function PositionTable({
  onInitialLoadComplete,
}: {
  onInitialLoadComplete?: () => void;
}) {
  const toast = useToast();
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [departments, setDepartments] = useState<{ departmentId: string; name: string }[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const hasReportedInitialLoadRef = useRef(false);

  const load = useCallback(async (includeArchived = showArchived) => {
    try {
      setLoading(true);
      setError(null);
      const [posResult, deptResult] = await Promise.all([
        listPositions({ includeArchived }),
        listDepartmentOptions(),
      ]);
      if (!posResult.success) {
        throw new Error(posResult.error || "Failed to load positions");
      }
      if (!deptResult.success) {
        throw new Error(deptResult.error || "Failed to load departments");
      }
      setPositions(posResult.data ?? []);
      setDepartments(deptResult.data ?? []);
    } catch (err) {
      console.error("Positions fetch failed", err);
      setError(err instanceof Error ? err.message : "Failed to load positions");
    } finally {
      setLoading(false);
      if (!hasReportedInitialLoadRef.current) {
        hasReportedInitialLoadRef.current = true;
        onInitialLoadComplete?.();
      }
    }
  }, [onInitialLoadComplete, showArchived]);

  useEffect(() => {
    void load(showArchived);
  }, [load, showArchived]);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return positions;
    return positions.filter((p) => {
      return (
        p.name.toLowerCase().includes(term) ||
        p.department?.name?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    });
  }, [positions, filter]);

  const formatCurrency = useCallback((value: number | null, currencyCode = "PHP") => {
    if (value == null) return "—";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currencyCode || "PHP",
      maximumFractionDigits: 2,
    }).format(value);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (!departmentId) {
      setFormError("Department is required");
      return;
    }
    const parsedDailyRate =
      dailyRate.trim() === "" ? null : Number.parseFloat(dailyRate);
    if (
      parsedDailyRate !== null &&
      (!Number.isFinite(parsedDailyRate) || parsedDailyRate < 0)
    ) {
      setFormError("Daily rate must be a valid non-negative number");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const result = editingId
        ? await updatePosition({
            positionId: editingId,
            name: name.trim(),
            description: description.trim() || null,
            departmentId,
            dailyRate: parsedDailyRate,
          })
        : await createPosition({
            name: name.trim(),
            description: description.trim() || null,
            departmentId,
            dailyRate: parsedDailyRate,
          });
      if (!result.success) {
        throw new Error(result.error || "Failed to save position");
      }
      await load();
      setOpen(false);
      setEditingId(null);
      setName("");
      setDescription("");
      setDepartmentId("");
      setDailyRate("");
      toast.success(
        editingId ? "Position updated successfully." : "Position created successfully.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save position";
      setFormError(message);
      toast.error("Failed to save position.", {
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (pos: PositionRow) => {
    if (!pos.isActive) return;
    setEditingId(pos.positionId);
    setName(pos.name);
    setDescription(pos.description || "");
    setDepartmentId(pos.departmentId);
    setDailyRate(pos.dailyRate == null ? "" : String(pos.dailyRate));
    setFormError(null);
    setOpen(true);
  };

  const closeDialog = (val: boolean) => {
    if (!val) {
      setEditingId(null);
      setName("");
      setDescription("");
      setDepartmentId("");
      setDailyRate("");
      setFormError(null);
    }
    setOpen(val);
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Archive this position? It will be hidden from active lists.",
    );
    if (!confirmed) return;
    try {
      setMutatingId(id);
      setError(null);
      const result = await archivePosition(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to archive position");
      }
      await load();
      toast.success("Position archived successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to archive position";
      setError(message);
      toast.error("Failed to archive position.", {
        description: message,
      });
    } finally {
      setMutatingId(null);
    }
  };

  const handleUnarchive = async (id: string) => {
    const confirmed = window.confirm(
      "Unarchive this position? It will appear again in active lists.",
    );
    if (!confirmed) return;
    try {
      setMutatingId(id);
      setError(null);
      const result = await unarchivePosition(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to unarchive position");
      }
      await load();
      toast.success("Position restored successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to unarchive position";
      setError(message);
      toast.error("Failed to restore position.", {
        description: message,
      });
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Positions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Titles linked to departments. Live pay rates now belong to positions and are historized automatically.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Input
            placeholder="Filter by name or department"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full sm:w-64"
          />
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void load()}
              aria-label="Reload positions"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button
              variant={showArchived ? "secondary" : "outline"}
              size="sm"
              type="button"
              onClick={() => setShowArchived((prev) => !prev)}
            >
              {showArchived ? (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Hide Archived
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Show Archived
                </>
              )}
            </Button>
            <Dialog open={open} onOpenChange={closeDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" type="button">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Position
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Position" : "Add Position"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="pos-name">Name</Label>
                    <Input
                      id="pos-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Software Engineer"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pos-dept">Department</Label>
                    <select
                      id="pos-dept"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                    >
                      <option value="">Select department</option>
                      {departments.map((dept) => (
                        <option key={dept.departmentId} value={dept.departmentId}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="pos-desc">Description</Label>
                    <Input
                      id="pos-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pos-daily-rate">Daily Rate (PHP)</Label>
                    <Input
                      id="pos-daily-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={dailyRate}
                      onChange={(e) => setDailyRate(e.target.value)}
                      placeholder="0.00"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Hourly and monthly rates are derived automatically and stored in position history.
                    </p>
                  </div>
                  {formError && <p className="text-sm text-destructive">{formError}</p>}
                </div>
                <DialogFooter>
                  <Button onClick={handleSave} disabled={saving} type="button">
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Current Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="p-3">
                    <TableLoadingState
                      label="Loading positions"
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
                    No positions found. Click Add Position to create one.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                !error &&
                filtered.map((pos) => (
                  <TableRow key={pos.positionId}>
                    <TableCell className="font-medium">{pos.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {pos.department?.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{formatCurrency(pos.dailyRate, pos.currencyCode)}</div>
                      <div className="text-xs">
                        Monthly {formatCurrency(pos.monthlyRate, pos.currencyCode)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={pos.isActive ? "secondary" : "outline"}>
                        {pos.isActive ? "Active" : "Archived"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {pos.description || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="gap-1"
                          onClick={() => startEdit(pos)}
                          disabled={!pos.isActive}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        {pos.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="gap-1 text-destructive"
                            onClick={() => handleDelete(pos.positionId)}
                            disabled={mutatingId === pos.positionId}
                          >
                            <Archive className="h-4 w-4" />
                            {mutatingId === pos.positionId ? "Archiving..." : "Archive"}
                          </Button>
                        )}
                        {!pos.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="gap-1"
                            onClick={() => handleUnarchive(pos.positionId)}
                            disabled={mutatingId === pos.positionId}
                          >
                            <RotateCcw className="h-4 w-4" />
                            {mutatingId === pos.positionId
                              ? "Restoring..."
                              : "Unarchive"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
