"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getViolations,
  reviewEmployeeViolation,
  type ViolationRow,
} from "@/actions/violations/violations-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ModuleLoadingState,
  TableLoadingState,
} from "@/components/loading/loading-states";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";

const ALL_STATUSES = "__ALL_STATUSES__";
const ALL_TYPES = "__ALL_TYPES__";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not recorded";

const formatStatus = (status: ViolationRow["status"]) => {
  if (status === "PENDING_EMPLOYEE") return "Pending Employee";
  if (status === "PENDING_MANAGER_REVIEW") return "Ready for Review";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Draft";
};

const statusClass = (status: ViolationRow["status"]) => {
  if (status === "APPROVED") return "border-emerald-600 text-emerald-700";
  if (status === "REJECTED") return "border-destructive text-destructive";
  if (status === "PENDING_MANAGER_REVIEW") return "border-blue-600 text-blue-700";
  return "border-orange-600 text-orange-700";
};

const canReview = (row: ViolationRow | null) =>
  row?.status === "PENDING_MANAGER_REVIEW";

const ManagerViolationsPage = () => {
  const toast = useToast();
  const [rows, setRows] = useState<ViolationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [selectedRow, setSelectedRow] = useState<ViolationRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [violationFilter, setViolationFilter] = useState<string>(ALL_TYPES);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  const counts = useMemo(
    () => ({
      pendingEmployee: rows.filter((row) => row.status === "PENDING_EMPLOYEE")
        .length,
      readyForReview: rows.filter(
        (row) => row.status === "PENDING_MANAGER_REVIEW",
      ).length,
      approved: rows.filter((row) => row.status === "APPROVED").length,
      rejected: rows.filter((row) => row.status === "REJECTED").length,
    }),
    [rows],
  );

  const violationTypes = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.violationName))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    return rows.filter((row) => {
      const haystack = [
        row.employeeName,
        row.employeeCode,
        row.violationName,
        row.remarks ?? "",
        row.reviewRemarks ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const rowDate = new Date(row.violationDate);
      const matchesSearch = !term || haystack.includes(term);
      const matchesStatus =
        statusFilter === ALL_STATUSES || row.status === statusFilter;
      const matchesViolation =
        violationFilter === ALL_TYPES || row.violationName === violationFilter;
      const matchesStart = !start || rowDate >= start;
      const matchesEnd = !end || rowDate <= end;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesViolation &&
        matchesStart &&
        matchesEnd
      );
    });
  }, [endDate, rows, searchTerm, startDate, statusFilter, violationFilter]);

  const openDetail = (row: ViolationRow) => {
    setSelectedRow(row);
    setReviewNote(row.reviewRemarks ?? "");
  };

  const handleReview = async (
    id: string,
    decision: "APPROVED" | "REJECTED",
  ) => {
    try {
      setReviewingId(id);
      setError(null);
      const note = reviewNote.trim() || undefined;
      const result = await reviewEmployeeViolation({
        id,
        decision,
        reviewRemarks: note,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to review violation");
      }
      await load();
      setSelectedRow(null);
      setReviewNote("");
      toast.success(
        decision === "APPROVED"
          ? "Violation approved successfully."
          : "Violation rejected successfully.",
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to review violation";
      setError(message);
      toast.error("Failed to review violation.", {
        description: message,
      });
    } finally {
      setReviewingId(null);
    }
  };

  if (loading && rows.length === 0 && !error) {
    return (
      <ModuleLoadingState
        title="Violation Board"
        description="Loading employee violations, appeal markers, and review queue."
      />
    );
  }

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">Violation Board</h1>
        <p className="text-sm text-muted-foreground">
          Review all employee violations without searching first. Final decisions
          unlock after employee appeal paper submission.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Employee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{counts.pendingEmployee}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ready for Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{counts.readyForReview}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{counts.approved}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{counts.rejected}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">All Violations</CardTitle>
            <CardDescription>
              Use filters to narrow the board; rows are visible by default.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="violation-search">Search</Label>
              <Input
                id="violation-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Employee, code, violation, remarks"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
                  <SelectItem value="PENDING_EMPLOYEE">
                    Pending Employee
                  </SelectItem>
                  <SelectItem value="PENDING_MANAGER_REVIEW">
                    Ready for Review
                  </SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Violation</Label>
              <Select
                value={violationFilter}
                onValueChange={setViolationFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES}>All types</SelectItem>
                  {violationTypes.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:col-span-1">
              <div className="space-y-2">
                <Label htmlFor="start-date">From</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">To</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Violation</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Acknowledged</TableHead>
                  <TableHead>Appeal Paper</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-3">
                      <TableLoadingState
                        label="Loading violations"
                        columns={7}
                        rows={5}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading && error ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-destructive">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading && !error && filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No violations match current filters.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading &&
                  !error &&
                  filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.employeeName}
                        <p className="text-xs text-muted-foreground">
                          {row.employeeCode}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p>{row.violationName}</p>
                        <p className="line-clamp-1 max-w-72 text-xs text-muted-foreground">
                          {row.remarks || "No remarks"}
                        </p>
                      </TableCell>
                      <TableCell>{formatDate(row.violationDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(row.status)}>
                          {formatStatus(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.isAcknowledged ? (
                          <span className="text-emerald-700">Yes</span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.appealSubmittedAt ? (
                          <span className="text-emerald-700">
                            {formatDate(row.appealSubmittedAt)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={canReview(row) ? "default" : "outline"}
                          onClick={() => openDetail(row)}
                        >
                          {canReview(row) ? "Review" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedRow)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRow(null);
            setReviewNote("");
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRow?.employeeName ?? "Violation"} -{" "}
              {selectedRow?.violationName ?? ""}
            </DialogTitle>
            <DialogDescription>
              Review employee acknowledgement, appeal paper status, and notes.
            </DialogDescription>
          </DialogHeader>

          {selectedRow ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Status
                  </p>
                  <Badge
                    variant="outline"
                    className={statusClass(selectedRow.status)}
                  >
                    {formatStatus(selectedRow.status)}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Employee Code
                  </p>
                  <p className="font-medium">{selectedRow.employeeCode}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Violation Date
                  </p>
                  <p className="font-medium">
                    {formatDate(selectedRow.violationDate)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Appeal Paper Submitted
                  </p>
                  <p className="font-medium">
                    {formatDateTime(selectedRow.appealSubmittedAt)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Acknowledged
                  </p>
                  <p className="font-medium">
                    {selectedRow.isAcknowledged
                      ? formatDateTime(selectedRow.acknowledgedAt)
                      : "Not acknowledged"}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    Reviewed
                  </p>
                  <p className="font-medium">
                    {formatDateTime(selectedRow.reviewedAt)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Supervisor Remarks
                </p>
                <p className="mt-1 text-sm">
                  {selectedRow.remarks || "No remarks"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-note">Manager Review Note</Label>
                <Textarea
                  id="review-note"
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="Add review note after checking hard-copy appeal paper"
                  disabled={!canReview(selectedRow)}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedRow(null)}
            >
              Close
            </Button>
            {canReview(selectedRow) ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    selectedRow &&
                    void handleReview(selectedRow.id, "REJECTED")
                  }
                  disabled={reviewingId === selectedRow?.id}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    selectedRow &&
                    void handleReview(selectedRow.id, "APPROVED")
                  }
                  disabled={reviewingId === selectedRow?.id}
                >
                  Approve
                </Button>
              </div>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagerViolationsPage;
