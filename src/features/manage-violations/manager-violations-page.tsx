"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getViolations,
  reviewEmployeeViolation,
  type ViolationRow,
} from "@/actions/violations/violations-action";
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

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatStatus = (status: ViolationRow["status"]) => {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Draft";
};

const ManagerViolationsPage = () => {
  const [rows, setRows] = useState<ViolationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getViolations();
      if (!result.success) {
        throw new Error(result.error || "Failed to load violations");
      }
      setRows(result.data ?? []);
    } catch (err) {
      setRows([]);
      setError(
        err instanceof Error ? err.message : "Failed to load violations",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const drafts = useMemo(
    () => rows.filter((row) => row.status === "DRAFT"),
    [rows],
  );
  const reviewed = useMemo(
    () =>
      rows
        .filter((row) => row.status !== "DRAFT")
        .sort(
          (a, b) =>
            new Date(b.reviewedAt ?? b.createdAt).getTime() -
            new Date(a.reviewedAt ?? a.createdAt).getTime(),
        )
        .slice(0, 8),
    [rows],
  );

  const approvedCount = rows.filter((row) => row.status === "APPROVED").length;
  const rejectedCount = rows.filter((row) => row.status === "REJECTED").length;

  const handleReview = async (
    id: string,
    decision: "APPROVED" | "REJECTED",
  ) => {
    try {
      setReviewingId(id);
      setError(null);
      const note = reviewNotes[id]?.trim() || undefined;
      const result = await reviewEmployeeViolation({
        id,
        decision,
        reviewRemarks: note,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to review violation");
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to review violation",
      );
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">Violation Review Queue</h1>
        <p className="text-sm text-muted-foreground">
          Review supervisor drafts and approve or reject with notes.
        </p>
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
            <p className="text-2xl font-semibold">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Draft Violations</CardTitle>
            <p className="text-sm text-muted-foreground">
              Waiting for manager review.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Violation</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>Review Note</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Loading drafts...
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
                {!loading && !error && drafts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No drafts waiting for review.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading &&
                  !error &&
                  drafts.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.employeeName}
                        <p className="text-xs text-muted-foreground">
                          {row.employeeCode}
                        </p>
                      </TableCell>
                      <TableCell>{row.violationName}</TableCell>
                      <TableCell>{formatDate(row.violationDate)}</TableCell>
                      <TableCell className="max-w-[16rem]">
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {row.remarks || "No remarks"}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-56">
                        <Input
                          value={reviewNotes[row.id] ?? ""}
                          onChange={(event) =>
                            setReviewNotes((previous) => ({
                              ...previous,
                              [row.id]: event.target.value,
                            }))
                          }
                          placeholder="Optional review note"
                        />
                      </TableCell>
                      <TableCell>
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
                            className="border-destructive text-destructive hover:bg-destructive/10"
                            onClick={() => void handleReview(row.id, "REJECTED")}
                            disabled={reviewingId === row.id}
                          >
                            Reject
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
          <CardTitle className="text-lg">Recently Reviewed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Violation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewed On</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No reviewed violations yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  reviewed.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.employeeName}
                      </TableCell>
                      <TableCell>{row.violationName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.status === "APPROVED"
                              ? "border-emerald-600 text-emerald-700"
                              : "border-destructive text-destructive"
                          }
                        >
                          {formatStatus(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.reviewedAt ? formatDate(row.reviewedAt) : "N/A"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.reviewRemarks || "No review note"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerViolationsPage;
