"use client";

import {
  createViolationDefinition,
  listViolationDefinitions,
  updateViolationDefinition,
} from "@/actions/violations/violations-action";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Plus, RefreshCcw } from "lucide-react";
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
import { TableLoadingState } from "@/components/loading/loading-states";

type ViolationDefinitionRow = {
  violationId: string;
  name: string;
  description: string;
  maxStrikesPerEmployee: number;
  isActive: boolean;
};

export default function ViolationsTable() {
  const [rows, setRows] = useState<ViolationDefinitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxStrikesPerEmployee, setMaxStrikesPerEmployee] = useState(3);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listViolationDefinitions();
      if (!result.success) {
        throw new Error(result.error || "Failed to load violations");
      }
      setRows(result.data ?? []);
    } catch (err) {
      console.error("Violation definitions fetch failed", err);
      setError(
        err instanceof Error ? err.message : "Failed to load violations",
      );
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      return (
        row.name.toLowerCase().includes(term) ||
        row.description.toLowerCase().includes(term)
      );
    });
  }, [rows, filter]);

  const handleSave = async () => {
    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      const payload = {
        name: name.trim(),
        description: description.trim(),
        maxStrikesPerEmployee,
        isActive,
      };
      const result = editingId
        ? await updateViolationDefinition({
            violationId: editingId,
            ...payload,
          })
        : await createViolationDefinition(payload);

      if (!result.success) {
        throw new Error(result.error || "Failed to save violation");
      }

      await load();
      closeDialog(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save violation",
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: ViolationDefinitionRow) => {
    setEditingId(row.violationId);
    setName(row.name);
    setDescription(row.description || "");
    setMaxStrikesPerEmployee(
      typeof row.maxStrikesPerEmployee === "number"
        ? row.maxStrikesPerEmployee
        : 3,
    );
    setIsActive(Boolean(row.isActive));
    setFormError(null);
    setOpen(true);
  };

  const closeDialog = (value: boolean) => {
    if (!value) {
      setEditingId(null);
      setName("");
      setDescription("");
      setMaxStrikesPerEmployee(3);
      setIsActive(true);
      setFormError(null);
    }
    setOpen(value);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Violation Directory</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create and maintain violation types like AWOL and insubordination.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Input
            placeholder="Filter by violation name"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="w-full sm:w-64"
          />
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={load}
              aria-label="Reload violation directory"
              type="button"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Dialog open={open} onOpenChange={closeDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" type="button">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Violation Type
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? "Edit Violation" : "Add Violation"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="violation-name">Name</Label>
                    <Input
                      id="violation-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g., AWOL"
                    />
                  </div>
                  <div>
                    <Label htmlFor="violation-description">Description</Label>
                    <Input
                      id="violation-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label htmlFor="violation-strike-points">
                      Max Strikes Per Employee
                    </Label>
                    <Input
                      id="violation-strike-points"
                      type="number"
                      min={1}
                      step={1}
                      value={maxStrikesPerEmployee}
                      onChange={(event) =>
                        setMaxStrikesPerEmployee(
                          Math.max(
                            1,
                            Math.floor(
                              Number.parseInt(event.target.value || "1", 10) ||
                                1,
                            ),
                          ),
                        )
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Every violation type always adds 1 strike when counted.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="violation-is-active"
                      type="checkbox"
                      checked={isActive}
                      onChange={(event) => setIsActive(event.target.checked)}
                      className="h-4 w-4 rounded border"
                    />
                    <Label htmlFor="violation-is-active">Active</Label>
                  </div>
                  {formError ? (
                    <p className="text-sm text-destructive">{formError}</p>
                  ) : null}
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
                <TableHead>Violation</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Strikes Rule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-3">
                    <TableLoadingState
                      label="Loading violation definitions"
                      columns={5}
                      rows={3}
                    />
                  </TableCell>
                </TableRow>
              ) : null}

              {error && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading && !error && filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-sm text-muted-foreground"
                  >
                    No violations yet. Click Add Violation to create one.
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading &&
                !error &&
                filtered.map((row) => (
                  <TableRow key={row.violationId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.description || "—"}
                    </TableCell>
                    <TableCell>
                      1 strike each, max {row.maxStrikesPerEmployee}
                    </TableCell>
                    <TableCell>
                      {row.isActive ? "Active" : "Inactive"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="gap-1"
                        onClick={() => startEdit(row)}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
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
