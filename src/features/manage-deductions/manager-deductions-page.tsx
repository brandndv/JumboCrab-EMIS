"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  listEmployeeDeductionAssignments,
  reviewEmployeeDeductionAssignment,
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
} from "@/features/manage-deductions/deduction-ui-helpers";
import { DeductionProgress } from "@/features/manage-deductions/deduction-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ManagerDeductionsPageProps = {
  rolePath?: "admin" | "manager";
};

export default function ManagerDeductionsPage({
  rolePath = "manager",
}: ManagerDeductionsPageProps) {
  const [rows, setRows] = useState<DeductionAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listEmployeeDeductionAssignments();
      if (!result.success) {
        throw new Error(result.error || "Failed to load deduction assignments");
      }
      setRows(result.data ?? []);
    } catch (err) {
      setRows([]);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load deduction assignments",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const drafts = useMemo(
    () => rows.filter((row) => row.workflowStatus === "DRAFT"),
    [rows],
  );
  const reviewed = useMemo(
    () =>
      rows
        .filter((row) => row.workflowStatus !== "DRAFT")
        .sort(
          (a, b) =>
            new Date(b.reviewedAt ?? b.updatedAt).getTime() -
            new Date(a.reviewedAt ?? a.updatedAt).getTime(),
        )
        .slice(0, 10),
    [rows],
  );

  const handleReview = async (
    id: string,
    decision: "APPROVED" | "REJECTED",
  ) => {
    try {
      setReviewingId(id);
      setError(null);
      const result = await reviewEmployeeDeductionAssignment({
        id,
        decision,
        reviewRemarks: reviewNotes[id],
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to review deduction draft");
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to review deduction draft",
      );
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deduction Review Queue</h1>
          <p className="text-sm text-muted-foreground">
            Review pending deduction drafts and approve or return them with notes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline">
            <Link href={`/${rolePath}/deductions/employee`}>
              Employee Deductions
            </Link>
          </Button>
          <Button asChild type="button">
            <Link href={`/${rolePath}/deductions/add`}>Assign Deduction</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{drafts.length}</p>
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
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Draft Assignments</CardTitle>
            <p className="text-sm text-muted-foreground">
              Waiting for manager approval.
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
                  <TableHead>Schedule</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Runtime Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Review Note</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      Loading drafts...
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading && drafts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      No deduction drafts waiting for review.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading &&
                  drafts.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.employeeName}
                        <p className="text-xs text-muted-foreground">
                          {row.employeeCode}
                        </p>
                      </TableCell>
                      <TableCell>
                        {row.deductionName}
                      </TableCell>
                      <TableCell>{describeAssignmentValue(row)}</TableCell>
                      <TableCell className="min-w-44">
                        <p>{formatDate(row.effectiveFrom)}</p>
                        <p className="text-xs text-muted-foreground">
                          Until {formatDate(row.effectiveTo)}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-56">
                        <DeductionProgress row={row} compact />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={runtimeStatusClass(row.status)}
                        >
                          {runtimeStatusLabel(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[16rem]">
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {row.reason || "No reason provided"}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-56">
                        <Input
                          value={reviewNotes[row.id] ?? ""}
                          onChange={(event) =>
                            setReviewNotes((current) => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                          placeholder="Required on return"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleReview(row.id, "APPROVED")}
                            disabled={reviewingId === row.id}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleReview(row.id, "REJECTED")}
                            disabled={reviewingId === row.id}
                          >
                            Return
                          </Button>
                        </div>
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
          <CardTitle className="text-lg">Recent Decisions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Latest approved and returned deduction assignments.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Deduction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payroll Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No reviewed assignments yet.
                    </TableCell>
                  </TableRow>
                ) : null}
                {reviewed.map((row) => (
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
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={runtimeStatusClass(row.status)}
                      >
                        {runtimeStatusLabel(row.status)}
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
                      {row.frequency === "INSTALLMENT" ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Remaining {formatMoney(row.remainingBalance ?? 0)}
                        </p>
                      ) : null}
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
