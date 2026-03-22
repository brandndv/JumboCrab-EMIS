"use client";

import Link from "next/link";
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
  workflowStatusClass,
  workflowStatusLabel,
} from "@/components/dasboard/manage-deductions/deduction-ui-helpers";
import { DeductionProgress } from "@/components/dasboard/manage-deductions/deduction-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ClerkDeductionsPage() {
  const [rows, setRows] = useState<DeductionAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listEmployeeDeductionAssignments();
      if (!result.success) {
        throw new Error(result.error || "Failed to load deduction drafts");
      }
      setRows(result.data ?? []);
    } catch (err) {
      setRows([]);
      setError(
        err instanceof Error ? err.message : "Failed to load deduction drafts",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openItems = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.workflowStatus === "DRAFT" || row.workflowStatus === "REJECTED",
      ),
    [rows],
  );

  const reviewedItems = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            row.workflowStatus === "APPROVED" || row.workflowStatus === "REJECTED",
        )
        .sort(
          (a, b) =>
            new Date(b.reviewedAt ?? b.updatedAt).getTime() -
            new Date(a.reviewedAt ?? a.updatedAt).getTime(),
        )
        .slice(0, 12),
    [rows],
  );

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Deduction Drafts</h1>
          <p className="text-sm text-muted-foreground">
            Create deduction drafts and track manager decisions.
          </p>
        </div>
        <Button asChild type="button">
          <Link href="/clerk/deductions/add">Create Deduction Draft</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {rows.filter((row) => row.workflowStatus === "DRAFT").length}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Returned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {rows.filter((row) => row.workflowStatus === "REJECTED").length}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {rows.filter((row) => row.workflowStatus === "APPROVED").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Open Items</CardTitle>
            <p className="text-sm text-muted-foreground">
              Drafts still waiting for review or returned for revision.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Deduction</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Payroll Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      Loading drafts...
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading && openItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      No draft items yet.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading &&
                  openItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.employeeName}
                        <p className="text-xs text-muted-foreground">
                          {row.employeeCode}
                        </p>
                      </TableCell>
                      <TableCell>
                        {row.deductionName}
                        <p className="text-xs text-muted-foreground">
                          {formatDate(row.effectiveFrom)} to{" "}
                          {formatDate(row.effectiveTo)}
                        </p>
                      </TableCell>
                      <TableCell>{describeAssignmentValue(row)}</TableCell>
                      <TableCell className="min-w-56">
                        <DeductionProgress row={row} compact />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={workflowStatusClass(row.workflowStatus)}
                        >
                          {workflowStatusLabel(row.workflowStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={runtimeStatusClass(row.status)}
                        >
                          {runtimeStatusLabel(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[18rem]">
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {row.reason || "No reason provided"}
                        </p>
                        {row.reviewRemarks ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            Manager note: {row.reviewRemarks}
                          </p>
                        ) : null}
                        {row.frequency === "INSTALLMENT" ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Remaining {formatMoney(row.remainingBalance ?? 0)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/clerk/deductions/add?assignmentId=${row.id}`}>
                            {row.workflowStatus === "REJECTED" ? "Revise" : "Edit"}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Recent Outcomes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Approved and returned drafts from your recent submissions.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Deduction</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No reviewed items yet.
                    </TableCell>
                  </TableRow>
                ) : null}
                {reviewedItems.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.employeeName}
                      <p className="text-xs text-muted-foreground">
                        {row.employeeCode}
                      </p>
                    </TableCell>
                    <TableCell>
                      {row.deductionName}
                      <p className="text-xs text-muted-foreground">
                        {describeAssignmentValue(row)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={workflowStatusClass(row.workflowStatus)}
                      >
                        {workflowStatusLabel(row.workflowStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-56">
                      <DeductionProgress row={row} compact />
                    </TableCell>
                    <TableCell>{formatDate(row.reviewedAt ?? row.updatedAt)}</TableCell>
                    <TableCell className="max-w-[18rem]">
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {row.reviewRemarks || "No remarks"}
                      </p>
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
