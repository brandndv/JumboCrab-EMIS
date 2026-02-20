"use client";

import { listDepartmentOptions } from "@/actions/organization/departments-action";
import {
  createPosition,
  deletePosition,
  listPositions,
  updatePosition,
} from "@/actions/organization/positions-action";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
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

type PositionRow = {
  positionId: string;
  name: string;
  description?: string | null;
  departmentId: string;
  department?: { departmentId: string; name: string } | null;
};

export function PositionTable() {
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
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [posResult, deptResult] = await Promise.all([
        listPositions(),
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
    }
  };

  useEffect(() => {
    load();
  }, []);

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

  const handleSave = async () => {
    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (!departmentId) {
      setFormError("Department is required");
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
          })
        : await createPosition({
            name: name.trim(),
            description: description.trim() || null,
            departmentId,
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
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save position");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (pos: PositionRow) => {
    setEditingId(pos.positionId);
    setName(pos.name);
    setDescription(pos.description || "");
    setDepartmentId(pos.departmentId);
    setFormError(null);
    setOpen(true);
  };

  const closeDialog = (val: boolean) => {
    if (!val) {
      setEditingId(null);
      setName("");
      setDescription("");
      setDepartmentId("");
      setFormError(null);
    }
    setOpen(val);
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this position? It will no longer appear in lists.");
    if (!confirmed) return;
    try {
      setDeletingId(id);
      setError(null);
      const result = await deletePosition(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete position");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete position");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Positions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Titles linked to departments. Assign these to employees.
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
            <Button variant="ghost" size="icon" onClick={load} aria-label="Reload positions">
              <RefreshCcw className="h-4 w-4" />
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
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {error && !loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
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
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="gap-1 text-destructive"
                          onClick={() => handleDelete(pos.positionId)}
                          disabled={deletingId === pos.positionId}
                        >
                          <Trash2 className="h-4 w-4" />
                          {deletingId === pos.positionId ? "Deleting..." : "Delete"}
                        </Button>
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
