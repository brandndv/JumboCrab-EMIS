"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createDeductionType,
  listDeductionTypes,
  updateDeductionType,
  type DeductionTypeRow,
} from "@/actions/deductions/deductions-action";
import {
  amountModeLabel,
  formatMoney,
  frequencyLabel,
} from "@/features/manage-deductions/deduction-ui-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeductionAmountMode, DeductionFrequency } from "@prisma/client";
import { Pencil, Plus, RefreshCcw } from "lucide-react";

type FormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
  amountMode: DeductionAmountMode;
  frequency: DeductionFrequency;
  defaultAmount: string;
  defaultPercent: string;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  code: "",
  name: "",
  description: "",
  amountMode: DeductionAmountMode.FIXED,
  frequency: DeductionFrequency.PER_PAYROLL,
  defaultAmount: "",
  defaultPercent: "",
  isActive: true,
});

export default function DeductionTypesPage() {
  const [rows, setRows] = useState<DeductionTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listDeductionTypes({ includeInactive: true });
      if (!result.success) {
        throw new Error(result.error || "Failed to load deduction types");
      }
      setRows(result.data ?? []);
    } catch (err) {
      setRows([]);
      setError(
        err instanceof Error ? err.message : "Failed to load deduction types",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      `${row.name} ${row.description ?? ""}`.toLowerCase().includes(term),
    );
  }, [filter, rows]);

  const closeDialog = (nextOpen: boolean) => {
    if (!nextOpen) {
      setForm(emptyForm());
      setFormError(null);
    }
    setOpen(nextOpen);
  };

  const startEdit = (row: DeductionTypeRow) => {
    setForm({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description ?? "",
      amountMode: row.amountMode,
      frequency: row.frequency,
      defaultAmount:
        typeof row.defaultAmount === "number" ? String(row.defaultAmount) : "",
      defaultPercent:
        typeof row.defaultPercent === "number" ? String(row.defaultPercent) : "",
      isActive: row.isActive,
    });
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    try {
      setSaving(true);
      setFormError(null);

      const payload = {
        code: form.code,
        name: form.name,
        description: form.description,
        amountMode: form.amountMode,
        frequency: form.frequency,
        defaultAmount: form.defaultAmount,
        defaultPercent: form.defaultPercent,
        isActive: form.isActive,
      };

      const result = form.id
        ? await updateDeductionType({ id: form.id, ...payload })
        : await createDeductionType(payload);

      if (!result.success) {
        throw new Error(result.error || "Failed to save deduction type");
      }

      await load();
      closeDialog(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save deduction type",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">Deduction Types</h1>
        <p className="text-sm text-muted-foreground">
          Create and maintain the deduction definitions used in employee
          assignments.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Type Directory</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage the master list for loans, advances, penalties, and other
              deductions.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter by name or description"
              className="w-full sm:w-72"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => void load()}
              aria-label="Refresh deduction types"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Dialog open={open} onOpenChange={closeDialog}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setForm(emptyForm());
                    setFormError(null);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Deduction Type
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {form.id ? "Edit Deduction Type" : "Add Deduction Type"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="deduction-name">Name</Label>
                    <Input
                      id="deduction-name"
                      value={form.name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="e.g. Cash Advance"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="deduction-description">Description</Label>
                    <Input
                      id="deduction-description"
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount Mode</Label>
                    <Select
                      value={form.amountMode}
                      onValueChange={(value: DeductionAmountMode) =>
                        setForm((current) => ({
                          ...current,
                          amountMode: value,
                          defaultAmount:
                            value === DeductionAmountMode.FIXED
                              ? current.defaultAmount
                              : "",
                          defaultPercent:
                            value === DeductionAmountMode.PERCENT
                              ? current.defaultPercent
                              : "",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={DeductionAmountMode.FIXED}>
                          Fixed amount
                        </SelectItem>
                        <SelectItem value={DeductionAmountMode.PERCENT}>
                          Percent
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={form.frequency}
                      onValueChange={(value: DeductionFrequency) =>
                        setForm((current) => ({
                          ...current,
                          frequency: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={DeductionFrequency.ONE_TIME}>
                          One-time
                        </SelectItem>
                        <SelectItem value={DeductionFrequency.PER_PAYROLL}>
                          Per payroll
                        </SelectItem>
                        <SelectItem value={DeductionFrequency.INSTALLMENT}>
                          Installment
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.amountMode === DeductionAmountMode.FIXED ? (
                    <div className="space-y-2">
                      <Label htmlFor="deduction-default-amount">
                        Default Amount
                      </Label>
                      <Input
                        id="deduction-default-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.defaultAmount}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            defaultAmount: event.target.value,
                          }))
                        }
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="deduction-default-percent">
                        Default Percent
                      </Label>
                      <Input
                        id="deduction-default-percent"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={form.defaultPercent}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            defaultPercent: event.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-7">
                    <input
                      id="deduction-is-active"
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          isActive: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border"
                    />
                    <Label htmlFor="deduction-is-active">Active</Label>
                  </div>
                  {formError ? (
                    <p className="text-sm text-destructive sm:col-span-2">
                      {formError}
                    </p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button type="button" onClick={submit} disabled={saving}>
                    {saving ? "Saving..." : "Save Deduction Type"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Loading deduction types...
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading && error ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-destructive">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading && !error && filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No deduction types found.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading &&
                  !error &&
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.name}
                        {row.description ? (
                          <p className="text-xs text-muted-foreground">
                            {row.description}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>{amountModeLabel(row.amountMode)}</TableCell>
                      <TableCell>{frequencyLabel(row.frequency)}</TableCell>
                      <TableCell>
                        {row.amountMode === DeductionAmountMode.FIXED
                          ? formatMoney(row.defaultAmount)
                          : `${row.defaultPercent ?? 0}%`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.isActive ? "default" : "outline"}>
                          {row.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(row)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
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
    </div>
  );
}
