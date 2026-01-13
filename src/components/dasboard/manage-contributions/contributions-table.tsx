"use client";

import { upsertEmployeeContribution } from "@/actions/contributions/contributions-action";
import { getGovernmentIdByEmployee } from "@/actions/contributions/government-ids-action";
import type { GovernmentIdRecord } from "@/actions/contributions/government-ids-action";
import { useMemo, useState } from "react";
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
import { ContributionRow } from "@/hooks/use-contributions";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, IdCard, Pencil } from "lucide-react";

type ContributionsTableProps = {
  rows: ContributionRow[];
  loading?: boolean;
  onRefresh?: () => void;
};

type ContributionFormState = {
  sssEe: number;
  sssEr: number;
  isSssActive: boolean;
  philHealthEe: number;
  philHealthEr: number;
  isPhilHealthActive: boolean;
  pagIbigEe: number;
  pagIbigEr: number;
  isPagIbigActive: boolean;
  withholdingEe: number;
  withholdingEr: number;
  isWithholdingActive: boolean;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

const agencies: { key: keyof ContributionRow; label: string }[] = [
  { key: "sssEe", label: "SSS" },
  { key: "philHealthEe", label: "PhilHealth" },
  { key: "pagIbigEe", label: "Pag-IBIG" },
  { key: "withholdingEe", label: "Tax" },
];

export function ContributionsTable({
  rows,
  loading,
  onRefresh,
}: ContributionsTableProps) {
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

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const nameA =
          typeof a.employeeName === "string"
            ? a.employeeName
            : String(a.employeeName ?? "");
        const nameB =
          typeof b.employeeName === "string"
            ? b.employeeName
            : String(b.employeeName ?? "");
        return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      }),
    [rows]
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
        Loading contributions...
      </div>
    );
  }

  if (!sortedRows.length) {
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
    setFormState({
      sssEe: row.sssEe ?? 0,
      sssEr: row.sssEr ?? 0,
      isSssActive: row.isSssActive ?? true,
      philHealthEe: row.philHealthEe ?? 0,
      philHealthEr: row.philHealthEr ?? 0,
      isPhilHealthActive: row.isPhilHealthActive ?? true,
      pagIbigEe: row.pagIbigEe ?? 0,
      pagIbigEr: row.pagIbigEr ?? 0,
      isPagIbigActive: row.isPagIbigActive ?? true,
      withholdingEe: row.withholdingEe ?? 0,
      withholdingEr: row.withholdingEr ?? 0,
      isWithholdingActive: row.isWithholdingActive ?? true,
    });
    setError(null);
    // Load Government IDs for context inside the editor
    getGovernmentIdByEmployee(row.employeeId)
      .then((result) => setGovId(result.success ? result.data || null : null))
      .catch(() => setGovId(null));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
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
        {sortedRows.map((row) => {
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
                      {row.isSet ? (
                        <>
                          <Badge variant="outline">
                            SSS {formatAmount(row.sssEe ?? 0)}
                          </Badge>
                          <Badge variant="outline">
                            PhilHealth {formatAmount(row.philHealthEe ?? 0)}
                          </Badge>
                          <Badge variant="outline">
                            Pag-IBIG {formatAmount(row.pagIbigEe ?? 0)}
                          </Badge>
                          <Badge variant="outline">
                            Tax {formatAmount(row.withholdingEe ?? 0)}
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
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {agencies.map((agency) => (
                      <div
                        key={agency.key}
                        className="rounded-lg border bg-background/60 px-3 py-3 shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>{agency.label} (EE)</span>
                          {govIds[row.employeeId] && (
                            <span className="flex items-center gap-1">
                              <IdCard className="h-3 w-3" />
                              {agency.key === "sssEe" &&
                                (govIds[row.employeeId]?.sssNumber || "No SSS")}
                              {agency.key === "philHealthEe" &&
                                (govIds[row.employeeId]?.philHealthNumber ||
                                  "No PhilHealth")}
                              {agency.key === "pagIbigEe" &&
                                (govIds[row.employeeId]?.pagIbigNumber ||
                                  "No Pag-IBIG")}
                              {agency.key === "withholdingEe" &&
                                (govIds[row.employeeId]?.tinNumber || "No TIN")}
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-semibold">
                          {formatAmount((row[agency.key] as number) ?? 0)}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          EE only. ER stored for admin views.
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
                            Update EE/ER amounts and activate/deactivate
                            agencies for payroll.
                          </p>
                        </DialogHeader>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            ["SSS", "sss", "isSssActive"],
                            ["PhilHealth", "philHealth", "isPhilHealthActive"],
                            ["Pag-IBIG", "pagIbig", "isPagIbigActive"],
                            ["Tax", "withholding", "isWithholdingActive"],
                          ].map(([label, key, activeKey]) => (
                            <div key={key} className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium capitalize">
                                  {label}
                                </div>
                                {govId && (
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <IdCard className="h-3 w-3" />
                                    {key === "sss" &&
                                      (govId.sssNumber || "No SSS")}
                                    {key === "philHealth" &&
                                      (govId.philHealthNumber ||
                                        "No PhilHealth")}
                                    {key === "pagIbig" &&
                                      (govId.pagIbigNumber || "No Pag-IBIG")}
                                    {key === "withholding" &&
                                      (govId.tinNumber || "No TIN")}
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
                                      formState
                                        ? (formState as any)[`${key}Ee`] ?? 0
                                        : 0
                                    }
                                    onChange={(e) =>
                                      setFormState((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              [`${key}Ee`]:
                                                e.target.value === ""
                                                  ? 0
                                                  : Number(e.target.value) || 0,
                                            }
                                          : null
                                      )
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
                                      formState
                                        ? (formState as any)[`${key}Er`] ?? 0
                                        : 0
                                    }
                                    onChange={(e) =>
                                      setFormState((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              [`${key}Er`]:
                                                e.target.value === ""
                                                  ? 0
                                                  : Number(e.target.value) || 0,
                                            }
                                          : null
                                      )
                                    }
                                    placeholder="ER"
                                  />
                                </div>
                              </div>
                              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-muted"
                                  checked={
                                    formState
                                      ? ((formState as any)[
                                          activeKey
                                        ] as boolean) ?? true
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
                                EE shows in directory; ER is stored for admin
                                use. Disable to exclude this agency.
                              </p>
                            </div>
                          ))}
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
