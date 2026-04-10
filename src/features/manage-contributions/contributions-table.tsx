"use client";

import { type ContributionPreviewLine } from "@/actions/contributions/contributions-action";
import { updateContributionPayrollInclusion } from "@/actions/contributions/government-ids-action";
import { InlineLoadingState } from "@/components/loading/loading-states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/toast-provider";
import { type ContributionRow } from "@/hooks/use-contributions";
import { ChevronDown, ChevronUp, IdCard, Loader2 } from "lucide-react";
import { useState } from "react";

type ContributionsTableProps = {
  rows: ContributionRow[];
  loading?: boolean;
  onUpdateContributionInclusion?: (input: {
    employeeId: string;
    contributionType: ContributionPreviewLine["contributionType"];
    includeInPayroll: boolean;
    updatedAt?: string;
  }) => void;
};

const formatCurrency = (value: number, currencyCode: string) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currencyCode || "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const formatOptionalCurrency = (value: number | null, currencyCode: string) =>
  value == null ? "—" : formatCurrency(value, currencyCode);

const humanizeType = (value: ContributionPreviewLine["contributionType"]) => {
  if (value === "PHILHEALTH") return "PhilHealth";
  if (value === "PAGIBIG") return "Pag-IBIG";
  if (value === "WITHHOLDING") return "Withholding";
  return "SSS";
};

const statusBadgeClass = (status: ContributionPreviewLine["status"]) => {
  if (status === "READY") return "border-emerald-600 text-emerald-700";
  if (status === "MISSING_GOV_ID") return "border-amber-600 text-amber-700";
  if (status === "NO_BRACKET") return "border-destructive text-destructive";
  return "border-muted-foreground text-muted-foreground";
};

const statusLabel = (status: ContributionPreviewLine["status"]) => {
  if (status === "READY") return "Ready";
  if (status === "MISSING_GOV_ID") return "Missing ID";
  if (status === "NO_BRACKET") return "No Bracket";
  return "Missing Rate";
};

export function ContributionsTable({
  rows,
  loading,
  onUpdateContributionInclusion,
}: ContributionsTableProps) {
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleTogglePayrollInclusion = async (
    row: ContributionRow,
    line: ContributionPreviewLine,
  ) => {
    const key = `${row.employeeId}:${line.contributionType}`;
    try {
      setPendingKey(key);
      const result = await updateContributionPayrollInclusion({
        employeeId: row.employeeId,
        contributionType: line.contributionType,
        includeInPayroll: !line.isIncludedInPayroll,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update payroll inclusion");
      }

      onUpdateContributionInclusion?.({
        employeeId: row.employeeId,
        contributionType: line.contributionType,
        includeInPayroll: !line.isIncludedInPayroll,
        updatedAt: result.data?.updatedAt,
      });
      toast.success(
        line.isIncludedInPayroll
          ? `${humanizeType(line.contributionType)} excluded from payroll.`
          : `${humanizeType(line.contributionType)} included in payroll.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update payroll inclusion";
      toast.error("Failed to update payroll inclusion.", {
        description: message,
      });
    } finally {
      setPendingKey(null);
    }
  };

  if (loading && rows.length === 0) {
    return <InlineLoadingState label="Loading contributions" lines={3} />;
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
        No contribution previews found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm">
      <div className="hidden grid-cols-12 gap-3 border-b border-border/70 px-4 py-3 text-sm font-medium text-muted-foreground md:grid">
        <div className="col-span-5">Employee</div>
        <div className="col-span-4">Computed Employee Share</div>
        <div className="col-span-3 text-right">Last Updated</div>
      </div>
      <div className="divide-y divide-border/70">
        {rows.map((row) => {
          const isOpen = openId === row.employeeId;
          const previewLines = [
            row.sss,
            row.philHealth,
            row.pagIbig,
            row.withholding,
          ];
          const includedLines = previewLines.filter(
            (line) => line.isIncludedInPayroll,
          );
          const excludedCount = previewLines.length - includedLines.length;
          const includedSummary =
            includedLines.length > 0
              ? includedLines.map((line) => humanizeType(line.contributionType)).join(", ")
              : "No statutory items included in payroll";

          return (
            <Collapsible
              key={row.employeeId}
              open={isOpen}
              onOpenChange={(open) => setOpenId(open ? row.employeeId : null)}
            >
              <CollapsibleTrigger asChild>
                <button className="grid w-full grid-cols-1 items-start gap-3 px-4 py-4 text-left text-sm transition hover:bg-muted/40 md:grid-cols-12 md:items-center">
                  <div className="flex items-center gap-3 md:col-span-5">
                    <Avatar className="h-10 w-10">
                      {row.avatarUrl ? (
                        <AvatarImage src={row.avatarUrl} alt={row.employeeName} />
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
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <span className="truncate">{row.employeeName}</span>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.employeeCode}
                        {row.positionName ? ` • ${row.positionName}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant={row.isReady ? "success" : "warning"}>
                          {row.isReady ? "Ready" : "Needs attention"}
                        </Badge>
                        <Badge variant="outline">
                          Included total {formatCurrency(row.eeTotal, row.currencyCode)}
                        </Badge>
                        {excludedCount > 0 ? (
                          <Badge variant="secondary">
                            {excludedCount} excluded from payroll
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {includedSummary}
                      </p>
                    </div>
                  </div>

                  <div className="text-muted-foreground md:col-span-3 md:text-right">
                    <p className="text-xs md:hidden">Last Updated</p>
                    <p>
                      {row.updatedAt
                        ? new Date(row.updatedAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="space-y-4 px-4 pb-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-lg border bg-background/60 px-3 py-3 shadow-xs">
                      <p className="text-xs text-muted-foreground">Department</p>
                      <p className="mt-1 text-sm font-medium">
                        {row.department || "Unassigned"}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background/60 px-3 py-3 shadow-xs">
                      <p className="text-xs text-muted-foreground">Current Position</p>
                      <p className="mt-1 text-sm font-medium">
                        {row.positionName || "Not assigned"}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background/60 px-3 py-3 shadow-xs">
                      <p className="text-xs text-muted-foreground">Daily Rate</p>
                      <p className="mt-1 text-sm font-medium">
                        {formatOptionalCurrency(row.dailyRate, row.currencyCode)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background/60 px-3 py-3 shadow-xs">
                      <p className="text-xs text-muted-foreground">Monthly Rate</p>
                      <p className="mt-1 text-sm font-medium">
                        {formatOptionalCurrency(row.monthlyRate, row.currencyCode)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {previewLines.map((line) => (
                      <div
                        key={line.contributionType}
                        className="rounded-xl border border-border/70 bg-background/40 p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">
                            {humanizeType(line.contributionType)}
                          </div>
                          <Badge
                            variant="outline"
                            className={statusBadgeClass(line.status)}
                          >
                            {statusLabel(line.status)}
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              line.isIncludedInPayroll ? "success" : "secondary"
                            }
                          >
                            {line.isIncludedInPayroll
                              ? "Included in payroll"
                              : "Excluded from payroll"}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              line.isIncludedInPayroll ? "outline" : "default"
                            }
                            disabled={
                              pendingKey ===
                              `${row.employeeId}:${line.contributionType}`
                            }
                            onClick={() =>
                              void handleTogglePayrollInclusion(row, line)
                            }
                          >
                            {pendingKey ===
                            `${row.employeeId}:${line.contributionType}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            {line.isIncludedInPayroll
                              ? "Exclude from payroll"
                              : "Include in payroll"}
                          </Button>
                        </div>

                        <div className="mt-3 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Employee share
                          </p>
                          <p className="text-lg font-semibold">
                            {formatCurrency(line.employeeShare, row.currencyCode)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Employer share{" "}
                            {formatCurrency(line.employerShare, row.currencyCode)}
                          </p>
                        </div>

                        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                          {!line.isIncludedInPayroll ? (
                            <p className="rounded-md border border-dashed border-border/70 bg-muted/20 px-2 py-1.5">
                              Excluded items stay visible here for reference but will
                              not be deducted when payroll is generated.
                            </p>
                          ) : null}
                          <div className="flex items-start gap-2">
                            <IdCard className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{line.governmentNumber || "Not set"}</span>
                          </div>
                          <p>
                            Basis:{" "}
                            {line.basisAmount == null
                              ? "—"
                              : formatCurrency(line.basisAmount, row.currencyCode)}
                          </p>
                          <p>
                            Range: {line.bracketRangeLabel || "—"}
                          </p>
                          <p>
                            Bracket: {line.bracketReference || line.bracketId || "—"}
                          </p>
                          {line.remarks && <p>{line.remarks}</p>}
                        </div>
                      </div>
                    ))}
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
