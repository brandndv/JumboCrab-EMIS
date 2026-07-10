"use client";

import {
  getMyContribution,
  listMyContributionDeductions,
  type EmployeeContributionDeductionRow,
  type ContributionPreviewLine,
  type ContributionPreviewRecord,
} from "@/actions/contributions/contributions-action";
import { ModuleLoadingState } from "@/components/loading/loading-states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast-provider";
import { IdCard } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const formatCurrency = (value: number, currencyCode: string) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currencyCode || "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const formatOptionalCurrency = (value: number | null, currencyCode: string) =>
  value == null ? "-" : formatCurrency(value, currencyCode);

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "-";

const formatPayrollType = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const contributionLabel = (
  value: ContributionPreviewLine["contributionType"],
) => {
  if (value === "PHILHEALTH") return "PhilHealth";
  if (value === "PAGIBIG") return "Pag-IBIG";
  if (value === "WITHHOLDING") return "Withholding";
  return "SSS";
};

const statusLabel = (status: ContributionPreviewLine["status"]) => {
  if (status === "READY") return "Ready";
  if (status === "MISSING_GOV_ID") return "Missing ID";
  if (status === "NO_BRACKET") return "No Bracket";
  return "Missing Rate";
};

const statusBadgeClass = (status: ContributionPreviewLine["status"]) => {
  if (status === "READY") return "border-emerald-600 text-emerald-700";
  if (status === "MISSING_GOV_ID") return "border-amber-600 text-amber-700";
  if (status === "NO_BRACKET") return "border-destructive text-destructive";
  return "border-muted-foreground text-muted-foreground";
};

export default function EmployeeContributionsPage() {
  const toast = useToast();
  const [record, setRecord] = useState<ContributionPreviewRecord | null>(null);
  const [deductedRows, setDeductedRows] = useState<
    EmployeeContributionDeductionRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [previewResult, deductedResult] = await Promise.all([
          getMyContribution(),
          listMyContributionDeductions(),
        ]);

        if (!previewResult.success) {
          throw new Error(
            previewResult.error || "Failed to load contributions",
          );
        }
        if (!deductedResult.success) {
          throw new Error(
            deductedResult.error || "Failed to load deducted contributions",
          );
        }
        setRecord(previewResult.data ?? null);
        setDeductedRows(deductedResult.data ?? []);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load contributions";
        setRecord(null);
        setDeductedRows([]);
        setError(message);
        toast.error("Failed to load contributions.", {
          description: message,
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [toast]);

  const previewLines = useMemo(
    () =>
      record
        ? [record.sss, record.philHealth, record.pagIbig, record.withholding]
        : [],
    [record],
  );

  const deductedTotal = useMemo(
    () => deductedRows.reduce((sum, row) => sum + row.amount, 0),
    [deductedRows],
  );

  if (loading && !error) {
    return (
      <ModuleLoadingState
        title="My Contributions"
        description="Loading your current statutory contribution preview."
      />
    );
  }

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">My Contributions</h1>
        <p className="text-sm text-muted-foreground">
          Review your current statutory payroll contribution preview.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!record && !error ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No contribution preview found.
          </CardContent>
        </Card>
      ) : null}

      {record ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Employee
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{record.employeeName}</p>
                <p className="text-sm text-muted-foreground">
                  {record.employeeCode}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Position
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {record.positionName || "Not assigned"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {record.department || "Unassigned"}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Daily Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {formatOptionalCurrency(record.dailyRate, record.currencyCode)}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Monthly Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {formatOptionalCurrency(record.monthlyRate, record.currencyCode)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg">Contribution Preview</CardTitle>
                <Badge variant={record.isReady ? "success" : "warning"}>
                  {record.isReady ? "Ready" : "Needs attention"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {previewLines.map((line) => (
                  <div
                    key={line.contributionType}
                    className="rounded-xl border border-border/70 bg-background p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">
                          {contributionLabel(line.contributionType)}
                        </h3>
                        <Badge
                          variant={
                            line.isIncludedInPayroll ? "success" : "secondary"
                          }
                          className="mt-2"
                        >
                          {line.isIncludedInPayroll
                            ? "Included in payroll"
                            : "Excluded from payroll"}
                        </Badge>
                      </div>
                      <Badge
                        variant="outline"
                        className={statusBadgeClass(line.status)}
                      >
                        {statusLabel(line.status)}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Employee Share
                      </p>
                      <p className="text-2xl font-semibold">
                        {formatCurrency(line.employeeShare, record.currencyCode)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Employer Share{" "}
                        {formatCurrency(line.employerShare, record.currencyCode)}
                      </p>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <IdCard className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{line.governmentNumber || "Not set"}</span>
                      </div>
                      <p>
                        Basis:{" "}
                        {line.basisAmount == null
                          ? "-"
                          : formatCurrency(line.basisAmount, record.currencyCode)}
                      </p>
                      <p>Range: {line.bracketRangeLabel || "-"}</p>
                      <p>
                        Bracket:{" "}
                        {line.bracketReference || line.bracketId || "-"}
                      </p>
                      {line.remarks ? <p>{line.remarks}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Deducted Contributions
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Released payroll contribution deductions already taken.
                  </p>
                </div>
                <Badge variant="outline">
                  Total {formatCurrency(deductedTotal, record.currencyCode)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {deductedRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                  No deducted contribution records found yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payroll Period</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Contribution</TableHead>
                      <TableHead className="text-right">Deducted</TableHead>
                      <TableHead className="text-right">Employer</TableHead>
                      <TableHead className="text-right">Basis</TableHead>
                      <TableHead>Bracket</TableHead>
                      <TableHead>Released</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deductedRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {formatDate(row.payrollPeriodStart)} to{" "}
                          {formatDate(row.payrollPeriodEnd)}
                        </TableCell>
                        <TableCell>{formatPayrollType(row.payrollType)}</TableCell>
                        <TableCell>
                          {contributionLabel(row.contributionType)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(row.amount, record.currencyCode)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatOptionalCurrency(
                            row.employerShare,
                            record.currencyCode,
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatOptionalCurrency(
                            row.compensationBasis,
                            record.currencyCode,
                          )}
                        </TableCell>
                        <TableCell>{row.bracketReference || "-"}</TableCell>
                        <TableCell>{formatDate(row.releasedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
