"use client";

import {
  archiveDepartment,
  createDepartment,
  listDepartmentsWithOptions,
  unarchiveDepartment,
  updateDepartment,
} from "@/actions/organization/departments-action";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Archive, Eye, EyeOff, Pencil, Plus, RefreshCcw, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type DepartmentRow = {
  departmentId: string;
  name: string;
  isActive: boolean;
  description?: string | null;
};

export function DepartmentTable() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const load = useCallback(async (includeArchived = showArchived) => {
    try {
      setLoading(true);
      setError(null);
      const result = await listDepartmentsWithOptions({ includeArchived });
      if (!result.success) {
        throw new Error(result.error || "Failed to load departments");
      }
      setDepartments(result.data ?? []);
    } catch (err) {
      console.error("Departments fetch failed", err);
      setError(err instanceof Error ? err.message : "Failed to load departments");
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  const handleSave = async () => {
    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const result = editingId
        ? await updateDepartment({
            departmentId: editingId,
            name: name.trim(),
            description: description.trim() || null,
          })
        : await createDepartment({
            name: name.trim(),
            description: description.trim() || null,
          });
      if (!result.success) {
        throw new Error(result.error || "Failed to save department");
      }
      await load();
      setOpen(false);
      setEditingId(null);
      setName("");
      setDescription("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save department");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (dept: DepartmentRow) => {
    setEditingId(dept.departmentId);
    setName(dept.name);
    setDescription(dept.description || "");
    setFormError(null);
    setOpen(true);
  };

  const closeDialog = (val: boolean) => {
    if (!val) {
      setEditingId(null);
      setName("");
      setDescription("");
      setFormError(null);
    }
    setOpen(val);
  };

  const handleArchive = async (id: string) => {
    const confirmed = window.confirm(
      "Archive this department? Positions under it will be archived too.",
    );
    if (!confirmed) return;
    try {
      setMutatingId(id);
      setError(null);
      const result = await archiveDepartment(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to archive department");
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to archive department",
      );
    } finally {
      setMutatingId(null);
    }
  };

  const handleUnarchive = async (id: string) => {
    const confirmed = window.confirm(
      "Unarchive this department? It will appear again in active lists.",
    );
    if (!confirmed) return;
    try {
      setMutatingId(id);
      setError(null);
      const result = await unarchiveDepartment(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to unarchive department");
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to unarchive department",
      );
    } finally {
      setMutatingId(null);
    }
  };

  useEffect(() => {
    void load(showArchived);
  }, [load, showArchived]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Departments</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage teams and link positions to each department.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void load()}
            aria-label="Reload departments"
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
                Add Department
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Department" : "Add Department"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="dept-name">Name</Label>
                  <Input
                    id="dept-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Engineering"
                  />
                </div>
                <div>
                  <Label htmlFor="dept-desc">Description</Label>
                  <Input
                    id="dept-desc"
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
      </CardHeader>
      <CardContent className="p-4">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
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
              {!loading && !error && departments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    No departments yet. Click Add Department to create one.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                !error &&
                departments.map((dept) => (
                  <TableRow key={dept.departmentId}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>
                      <Badge variant={dept.isActive ? "secondary" : "outline"}>
                        {dept.isActive ? "Active" : "Archived"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dept.description || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="gap-1"
                          onClick={() => startEdit(dept)}
                          disabled={!dept.isActive}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        {dept.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="gap-1 text-destructive"
                            onClick={() => handleArchive(dept.departmentId)}
                            disabled={mutatingId === dept.departmentId}
                          >
                            <Archive className="h-4 w-4" />
                            {mutatingId === dept.departmentId
                              ? "Archiving..."
                              : "Archive"}
                          </Button>
                        )}
                        {!dept.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="gap-1"
                            onClick={() => handleUnarchive(dept.departmentId)}
                            disabled={mutatingId === dept.departmentId}
                          >
                            <RotateCcw className="h-4 w-4" />
                            {mutatingId === dept.departmentId
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
