"use client";

import { upsertEmployeeContribution } from "@/actions/contributions/contributions-action";
import { getGovernmentIdByEmployee } from "@/actions/contributions/government-ids-action";
import type { GovernmentIdRecord } from "@/actions/contributions/government-ids-action";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { InlineLoadingState } from "@/components/loading/loading-states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import { ContributionRow } from "@/hooks/use-contributions";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, IdCard, Pencil } from "lucide-react";
import {
  buildContributionFormState,
  contributionEditorSections,
  contributionScheduleOptions,
  formatContributionCurrency,
  humanizeContributionSchedule,
  humanizePayrollFrequency,
  payrollFrequencyOptions,
  type ContributionFormState,
} from "@/features/manage-contributions/contribution-editor-shared";

type ContributionsTableProps = {
  rows: ContributionRow[];
  loading?: boolean;
  onRefresh?: () => void;
};

export function ContributionsTable({
  rows,
  loading,
  onRefresh,
}: ContributionsTableProps) {
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState<ContributionFormState | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [govIds, setGovIds] = useState<
    Record<string, GovernmentIdRecord | null>
  >({});
  const [govId, setGovId] = useState<GovernmentIdRecord | null>(null);

  if (loading) {
    return <InlineLoadingState label="Loading contributions" lines={3} />;
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
        No contributions found.
      </div>
    );
  }

  const handleOpenChange = (row: ContributionRow, state: boolean) => {
    if (state && !govIds[row.employeeId]) {
      getGovernmentIdByEmployee(row.employeeId)
        .then((result) => {
          if (!result.success) return;
          setGovIds((prev) => ({
            ...prev,
            [row.employeeId]: result.data || null,
          }));
        })
        .catch(() => {});
    }
    setOpenId(state ? row.employeeId : null);
  };

  const startEdit = (row: ContributionRow) => {
    setEditingId(row.employeeId);
    setFormState(buildContributionFormState(row));
    setError(null);
    // Load Government IDs for context inside the editor
    getGovernmentIdByEmployee(row.employeeId)
      .then((result) => setGovId(result.success ? result.data || null : null))
      .catch(() => setGovId(null));
  };

  const updateNumberField = (
    field: keyof ContributionFormState,
    value: string
  ) => {
    setFormState((prev) =>
      prev
        ? {
            ...prev,
            [field]: value === "" ? 0 : Number(value) || 0,
          }
        : null
    );
  };

  const handleSave = async (employeeId: string) => {
    try {
      setSaving(true);
      setError(null);
      if (!formState) {
        throw new Error("Form not initialized");
      }
      const result = await upsertEmployeeContribution({
        employeeId,
        ...formState,
        effectiveDate: undefined,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to save");
      }
      setEditingId(null);
      onRefresh?.();
      toast.success("Contributions saved successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
      toast.error("Failed to save contributions.", {
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 shadow-sm overflow-hidden">
      <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 text-sm font-medium text-muted-foreground border-b border-border/70">
        <div className="col-span-5">Employee</div>
        <div className="col-span-4">EE Contribution</div>
        <div className="col-span-3 text-right">Last Updated</div>
      </div>
      <div className="divide-y divide-border/70">
        {rows.map((row) => {
          const isOpen = openId === row.employeeId;
          return (
            <Collapsible
              key={row.employeeId}
              open={isOpen}
              onOpenChange={(state) => handleOpenChange(row, state)}
            >
              <CollapsibleTrigger asChild>
                <button className="w-full grid grid-cols-1 gap-3 px-4 py-4 text-sm items-start md:grid-cols-12 md:items-center hover:bg-muted/40 transition">
                  <div className="md:col-span-5 flex items-center gap-3 text-left">
                    <Avatar className="h-10 w-10">
                      {row.avatarUrl ? (
                        <AvatarImage
                          src={row.avatarUrl}
                          alt={row.employeeName}
                        />
                      ) : (
                        <AvatarFallback>
                          {row.employeeName
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground flex items-center gap-2 truncate">
                        <span className="truncate">{row.employeeName}</span>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {row.employeeCode}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-4 text-left">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <p className="md:hidden text-muted-foreground">
                        EE Contribution
                      </p>
                      <Badge variant={row.isSet ? "default" : "outline"}>
                        {row.isSet ? "Set" : "Not set"}
                      </Badge>
                      <Badge variant="secondary">
                        {humanizePayrollFrequency(
                          row.payrollFrequency ?? "BIMONTHLY"
                        )}
                      </Badge>
                      <Badge variant="outline">
                        {(row.currencyCode ?? "PHP").toUpperCase()}
                      </Badge>
                      {row.isSet ? (
                        <>
                          <Badge variant="outline">
                            SSS{" "}
                            {formatContributionCurrency(
                              row.sssEe ?? 0,
                              row.currencyCode
                            )}
                          </Badge>
                          <Badge variant="outline">
                            PhilHealth{" "}
                            {formatContributionCurrency(
                              row.philHealthEe ?? 0,
                              row.currencyCode
                            )}
                          </Badge>
                          <Badge variant="outline">
                            Pag-IBIG{" "}
                            {formatContributionCurrency(
                              row.pagIbigEe ?? 0,
                              row.currencyCode
                            )}
                          </Badge>
                          <Badge variant="outline">
                            Tax{" "}
                            {formatContributionCurrency(
                              row.withholdingEe ?? 0,
                              row.currencyCode
                            )}
                          </Badge>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          No EE contributions set
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "md:col-span-3 text-muted-foreground",
                      "md:text-right"
                    )}
                  >
                    <p className="text-xs text-muted-foreground md:hidden">
                      Last Updated
                    </p>
                    <p>
                      {row.updatedAt
                        ? new Date(row.updatedAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4">
                  <div className="mb-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border bg-background/60 px-3 py-3 shadow-xs">
                      <p className="text-xs text-muted-foreground">
                        Payroll cadence
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {humanizePayrollFrequency(
                          row.payrollFrequency ?? "BIMONTHLY"
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background/60 px-3 py-3 shadow-xs">
                      <p className="text-xs text-muted-foreground">Currency</p>
                      <p className="mt-1 text-sm font-medium">
                        {(row.currencyCode ?? "PHP").toUpperCase()}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background/60 px-3 py-3 shadow-xs">
                      <p className="text-xs text-muted-foreground">
                        Auto-apply behavior
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Each agency schedule below controls when payroll creates
                        the deduction automatically.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {contributionEditorSections.map((agency) => (
                      <div
                        key={agency.eeKey}
                        className="rounded-lg border bg-background/60 px-3 py-3 shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>{agency.label}</span>
                          {govIds[row.employeeId] && (
                            <span className="flex items-center gap-1">
                              <IdCard className="h-3 w-3" />
                              {govIds[row.employeeId]?.[agency.governmentIdKey] ||
                                `No ${agency.label}`}
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-semibold">
                          {formatContributionCurrency(
                            (row[agency.eeKey] as number) ?? 0,
                            row.currencyCode
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge
                            variant={
                              row[agency.activeKey] ? "default" : "outline"
                            }
                          >
                            {row[agency.activeKey] ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline">
                            {humanizeContributionSchedule(
                              row[agency.scheduleKey] ?? "PER_PAYROLL"
                            )}
                          </Badge>
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          ER{" "}
                          {formatContributionCurrency(
                            (row[agency.erKey] as number) ?? 0,
                            row.currencyCode
                          )}{" "}
                          stored for payroll/admin reporting.
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-3">
                    <Dialog
                      open={editingId === row.employeeId}
                      onOpenChange={(open) =>
                        open ? startEdit(row) : setEditingId(null)
                      }
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Pencil className="h-4 w-4" />
                          Edit Contributions
                        </Button>
                      </DialogTrigger>
                      <DialogContent aria-describedby="contrib-dialog-desc">
                        <DialogHeader>
                          <DialogTitle>
                            Edit contributions for {row.employeeName}
                          </DialogTitle>
                          <p id="contrib-dialog-desc" className="sr-only">
                            Update payroll cadence, currency, EE/ER amounts,
                            contribution schedules, and agency status for
                            payroll.
                          </p>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`payroll-frequency-${row.employeeId}`}>
                                Payroll frequency
                              </Label>
                              <Select
                                value={formState?.payrollFrequency ?? "BIMONTHLY"}
                                onValueChange={(value) =>
                                  setFormState((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          payrollFrequency:
                                            value as ContributionFormState["payrollFrequency"],
                                        }
                                      : null
                                  )
                                }
                              >
                                <SelectTrigger
                                  id={`payroll-frequency-${row.employeeId}`}
                                  className="w-full"
                                >
                                  <SelectValue placeholder="Select payroll frequency" />
                                </SelectTrigger>
                                <SelectContent>
                                  {payrollFrequencyOptions.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`currency-code-${row.employeeId}`}>
                                Currency code
                              </Label>
                              <Input
                                id={`currency-code-${row.employeeId}`}
                                value={formState?.currencyCode ?? "PHP"}
                                onChange={(event) =>
                                  setFormState((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          currencyCode: event.target.value
                                            .toUpperCase()
                                            .slice(0, 8),
                                        }
                                      : null
                                  )
                                }
                                placeholder="PHP"
                                maxLength={8}
                              />
                            </div>
                          </div>
                          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                            This editor now controls the contribution cadence
                            used by payroll generation on this screen, not just
                            the predefined EE/ER amounts.
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                          {contributionEditorSections.map(
                            ({
                              label,
                              eeKey,
                              erKey,
                              activeKey,
                              scheduleKey,
                              governmentIdKey,
                            }) => {
                              const currentSchedule =
                                formState?.[scheduleKey] ?? "PER_PAYROLL";

                              return (
                                <div
                                  key={eeKey}
                                  className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-4"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-medium capitalize">
                                      {label}
                                    </div>
                                    {govId && (
                                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <IdCard className="h-3 w-3" />
                                        {govId[governmentIdKey] ||
                                          `No ${label}`}
                                      </div>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <p className="text-[11px] text-muted-foreground">
                                        EE
                                      </p>
                                      <Input
                                        type="number"
                                        value={
                                          formState ? formState[eeKey] ?? 0 : 0
                                        }
                                        onChange={(e) =>
                                          updateNumberField(eeKey, e.target.value)
                                        }
                                        placeholder="EE"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[11px] text-muted-foreground">
                                        ER
                                      </p>
                                      <Input
                                        type="number"
                                        value={
                                          formState ? formState[erKey] ?? 0 : 0
                                        }
                                        onChange={(e) =>
                                          updateNumberField(erKey, e.target.value)
                                        }
                                        placeholder="ER"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-muted-foreground">
                                      Auto-apply schedule
                                    </Label>
                                    <Select
                                      value={currentSchedule}
                                      onValueChange={(value) =>
                                        setFormState((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                [scheduleKey]:
                                                  value as ContributionFormState[typeof scheduleKey],
                                              }
                                            : null
                                        )
                                      }
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a schedule" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {contributionScheduleOptions.map(
                                          (option) => (
                                            <SelectItem
                                              key={option.value}
                                              value={option.value}
                                            >
                                              {option.label}
                                            </SelectItem>
                                          )
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-muted"
                                      checked={
                                        formState
                                          ? formState[activeKey] ?? true
                                          : true
                                      }
                                      onChange={(e) =>
                                        setFormState((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                [activeKey]: e.target.checked,
                                              }
                                            : null
                                        )
                                      }
                                    />
                                    Active in payroll
                                  </label>
                                  <p className="text-[11px] text-muted-foreground">
                                    EE shows in the directory. ER is stored for
                                    admin reporting. Schedule decides when this
                                    deduction is auto-created during payroll.
                                  </p>
                                </div>
                              );
                            },
                          )}
                          </div>
                        </div>
                        {error && (
                          <p className="text-sm text-destructive">{error}</p>
                        )}
                        <DialogFooter>
                          <Button
                            onClick={() => handleSave(row.employeeId)}
                            disabled={saving}
                            className="gap-2"
                          >
                            {saving && (
                              <span className="h-3 w-3 animate-spin rounded-full border border-border border-t-transparent" />
                            )}
                            Save
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
