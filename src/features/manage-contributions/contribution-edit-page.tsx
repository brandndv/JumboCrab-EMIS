"use client";

import { getEmployeeContribution } from "@/actions/contributions/contributions-action";
import { ModuleLoadingState } from "@/components/loading/loading-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";
import type { PayrollFrequency } from "@prisma/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ContributionEditPageProps = {
  employeeId: string;
  returnPath: string;
};

const formatCurrency = (value: number, currencyCode: string) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currencyCode || "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const statusLabel = (status: string) => {
  if (status === "READY") return "Ready";
  if (status === "MISSING_GOV_ID") return "Missing ID";
  if (status === "NO_BRACKET") return "No Bracket";
  return "Missing Rate";
};

export function ContributionEditPage({
  employeeId,
  returnPath,
}: ContributionEditPageProps) {
  const toast = useToast();
  const [previewFrequency, setPreviewFrequency] =
    useState<PayrollFrequency>("BIMONTHLY");
  const [record, setRecord] = useState<Awaited<
    ReturnType<typeof getEmployeeContribution>
  >["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getEmployeeContribution({
          employeeId,
          previewFrequency,
        });
        if (!result.success) {
          throw new Error(result.error || "Failed to load contribution preview");
        }
        setRecord(result.data ?? null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load contribution preview";
        setError(message);
        toast.error("Failed to load contribution preview.", {
          description: message,
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [employeeId, previewFrequency, toast]);

  const previewLines = useMemo(
    () =>
      record
        ? [record.sss, record.philHealth, record.pagIbig, record.withholding]
        : [],
    [record],
  );

  if (loading) {
    return (
      <ModuleLoadingState
        title="Contribution Preview"
        description="Loading current statutory contribution brackets for this employee."
      />
    );
  }

  return (
    <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contribution Preview</h1>
          <p className="text-sm text-muted-foreground">
            Read-only statutory contribution preview based on position-owned rates and seeded official brackets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={previewFrequency}
            onChange={(event) =>
              setPreviewFrequency(event.target.value as PayrollFrequency)
            }
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="BIMONTHLY">Semi-monthly tax preview</option>
            <option value="WEEKLY">Weekly tax preview</option>
            <option value="MONTHLY">Monthly tax preview</option>
          </select>
          <Button asChild variant="outline">
            <Link href={returnPath}>Back</Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!record ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No contribution preview found for this employee.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Employee
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{record.employeeName}</p>
                <p className="text-sm text-muted-foreground">
                  {record.employeeCode}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Position
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{record.positionName || "Not assigned"}</p>
                <p className="text-sm text-muted-foreground">
                  {record.department || "Unassigned"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Daily Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">
                  {record.dailyRate == null
                    ? "—"
                    : formatCurrency(record.dailyRate, record.currencyCode)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Monthly Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">
                  {record.monthlyRate == null
                    ? "—"
                    : formatCurrency(record.monthlyRate, record.currencyCode)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {previewLines.map((line) => (
              <Card key={line.contributionType}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {line.contributionType === "PHILHEALTH"
                        ? "PhilHealth"
                        : line.contributionType === "PAGIBIG"
                          ? "Pag-IBIG"
                          : line.contributionType === "WITHHOLDING"
                            ? "Withholding"
                            : "SSS"}
                    </CardTitle>
                    <Badge variant="outline">{statusLabel(line.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    EE: {formatCurrency(line.employeeShare, record.currencyCode)}
                  </p>
                  <p className="text-muted-foreground">
                    ER: {formatCurrency(line.employerShare, record.currencyCode)}
                  </p>
                  <p className="text-muted-foreground">
                    Basis:{" "}
                    {line.basisAmount == null
                      ? "—"
                      : formatCurrency(line.basisAmount, record.currencyCode)}
                  </p>
                  <p className="text-muted-foreground">
                    ID: {line.governmentNumber || "Not set"}
                  </p>
                  <p className="text-muted-foreground">
                    Bracket: {line.bracketReference || line.bracketId || "—"}
                  </p>
                  {line.remarks && (
                    <p className="text-muted-foreground">{line.remarks}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ContributionEditPage;
