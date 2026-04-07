"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listEmployeeDeductionAssignments,
  type DeductionAssignmentRow,
} from "@/actions/deductions/deductions-action";
import {
  describeAssignmentValue,
  formatDate,
  formatMoney,
  runtimeStatusClass,
  runtimeStatusLabel,
} from "@/features/manage-deductions/deduction-ui-helpers";
import { DeductionProgress } from "@/features/manage-deductions/deduction-progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleLoadingState } from "@/components/loading/loading-states";
import { DeductionFrequency, EmployeeDeductionAssignmentStatus } from "@prisma/client";

export default function EmployeeDeductionsPage() {
  const [rows, setRows] = useState<DeductionAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listEmployeeDeductionAssignments();
      if (!result.success) {
        throw new Error(result.error || "Failed to load deductions");
      }
      setRows(result.data ?? []);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Failed to load deductions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const ongoingCount = useMemo(
    () =>
      rows.filter((row) => {
        if (
          row.status === EmployeeDeductionAssignmentStatus.COMPLETED ||
          row.status === EmployeeDeductionAssignmentStatus.CANCELLED
        ) {
          return false;
        }

        if (row.frequency !== DeductionFrequency.INSTALLMENT) return true;

        const balanceSeed = row.remainingBalance ?? row.installmentTotal;
        return typeof balanceSeed === "number" ? balanceSeed > 0 : true;
      }).length,
    [rows],
  );
  const installmentCount = useMemo(
    () =>
      rows.filter((row) => {
        if (row.frequency !== DeductionFrequency.INSTALLMENT) return false;
        if (
          row.status === EmployeeDeductionAssignmentStatus.COMPLETED ||
          row.status === EmployeeDeductionAssignmentStatus.CANCELLED
        ) {
          return false;
        }

        const balanceSeed = row.remainingBalance ?? row.installmentTotal;
        return typeof balanceSeed === "number" ? balanceSeed > 0 : true;
      }).length,
    [rows],
  );
  const completedCount = useMemo(
    () => rows.filter((row) => row.status === EmployeeDeductionAssignmentStatus.COMPLETED).length,
    [rows],
  );

  if (loading && rows.length === 0 && !error) {
    return (
      <ModuleLoadingState
        title="My Deductions"
        description="Loading your deduction balances, schedules, and approved assignments."
      />
    );
  }

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">My Deductions</h1>
        <p className="text-sm text-muted-foreground">
          Review the approved deduction assignments linked to your payroll.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ongoing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{ongoingCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{completedCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open Installments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{installmentCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Approved Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No approved deductions found.
            </p>
          ) : null}
          <div className="space-y-4">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-border/70 bg-background p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{row.deductionName}</h3>
                      <Badge
                        variant="outline"
                        className={runtimeStatusClass(row.status)}
                      >
                        {runtimeStatusLabel(row.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {describeAssignmentValue(row)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(row.effectiveFrom)} to {formatDate(row.effectiveTo)}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[18rem]">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Value
                      </p>
                      <p className="mt-2 font-medium">{describeAssignmentValue(row)}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Balance
                      </p>
                      <p className="mt-2 font-medium">
                        {row.frequency === DeductionFrequency.INSTALLMENT
                          ? formatMoney(row.remainingBalance ?? 0)
                          : row.status === EmployeeDeductionAssignmentStatus.COMPLETED
                            ? "Settled"
                            : "Ongoing"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <DeductionProgress row={row} />
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Payment Notes
                    </p>
                    {row.payments[0] ? (
                      <p className="text-sm text-muted-foreground">
                        Last manual payment {formatMoney(row.payments[0].amount)} on{" "}
                        {formatDate(row.payments[0].paymentDate)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No manual payments recorded yet.
                      </p>
                    )}
                    {row.frequency === DeductionFrequency.INSTALLMENT ? (
                      <p className="text-xs text-muted-foreground">
                        {row.payments.length} payment record
                        {row.payments.length === 1 ? "" : "s"} logged so far.
                      </p>
                    ) : row.frequency === DeductionFrequency.ONE_TIME ? (
                      <p className="text-xs text-muted-foreground">
                        This one-time deduction can be settled manually or on payroll release.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Manual payments are tracked separately from recurring payroll deductions.
                      </p>
                    )}
                  </div>
                </div>

                {row.reason ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {row.reason}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
