"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSuspiciousAttendanceLogDetail,
  listLockableEmployees,
  listSuspiciousAttendanceLogs,
  reviewSuspiciousAttendanceLog,
} from "@/actions/attendance/attendance-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { TableLoadingState } from "@/components/loading/loading-states";
import { useToast } from "@/components/ui/toast-provider";
import { TZ } from "@/lib/timezone";

type EmployeeOption = {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
};

type SuspiciousLogRow = {
  id: string;
  attendanceId: string | null;
  deviceLogId: string | null;
  employeeId: string;
  reason: string;
  severity: string;
  detectedByRule: string;
  status: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  remarks: string | null;
  details: unknown;
  createdAt: string;
  employee: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
  } | null;
  reviewedBy: {
    userId: string;
    username: string;
  } | null;
  attendance: {
    id: string;
    workDate: string;
    status: string;
    actualInAt: string | null;
    actualOutAt: string | null;
    isFlagged: boolean;
  } | null;
  deviceLog: {
    id: string;
    attendanceId: string;
    employeeId: string;
    ipAddress: string | null;
    userAgent: string | null;
    deviceToken: string | null;
    fingerprint: string | null;
    latitude: number | null;
    longitude: number | null;
    isFlagged: boolean;
    createdAt: string;
  } | null;
  relatedLogs?: SuspiciousLogRow[];
};

const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

const sevenDaysAgoISO = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toLocaleDateString("en-CA", { timeZone: TZ });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatStatusLabel = (value: string) => {
  if (value === "REVIEWED") return "Suspicious";
  return value
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

const previewHash = (value?: string | null) => {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 12)}…`;
};

const statusVariant = (value: string) => {
  if (value === "VALID") return "success" as const;
  if (value === "REJECTED") return "destructive" as const;
  if (value === "REVIEWED") return "warning" as const;
  return "info" as const;
};

const severityVariant = (value: string) => {
  if (value === "HIGH") return "destructive" as const;
  if (value === "MEDIUM") return "warning" as const;
  return "secondary" as const;
};

export function SuspiciousLogsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<SuspiciousLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [query, setQuery] = useState("");
  const [employeeIdFilter, setEmployeeIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all");
  const [severityFilter, setSeverityFilter] = useState("__all");
  const [startDate, setStartDate] = useState(sevenDaysAgoISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SuspiciousLogRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewDecision, setReviewDecision] =
    useState<"VALID" | "SUSPICIOUS" | "REJECTED">("SUSPICIOUS");
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const selectedEmployeeLabel = useMemo(() => {
    if (!employeeIdFilter) return "All employees";
    const employee = employees.find((row) => row.employeeId === employeeIdFilter);
    if (!employee) return "All employees";
    return `${employee.employeeCode} - ${employee.firstName} ${employee.lastName}`;
  }, [employeeIdFilter, employees]);

  const loadEmployees = async () => {
    const result = await listLockableEmployees({ limit: 500 });
    if (result.success) {
      setEmployees(result.data ?? []);
    }
  };

  const load = async (overrides?: {
    startDate?: string;
    endDate?: string;
    employeeId?: string;
    query?: string;
    status?: string;
    severity?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const result = await listSuspiciousAttendanceLogs({
        start: overrides?.startDate ?? startDate,
        end: overrides?.endDate ?? endDate,
        query: overrides?.query ?? query,
        employeeId:
          (overrides?.employeeId ?? employeeIdFilter) || undefined,
        status:
          (overrides?.status ?? statusFilter) === "__all"
            ? undefined
            : (overrides?.status ?? statusFilter),
        severity:
          (overrides?.severity ?? severityFilter) === "__all"
            ? undefined
            : (overrides?.severity ?? severityFilter),
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to load suspicious logs");
      }

      setRows((result.data ?? []) as SuspiciousLogRow[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load suspicious logs",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      setDialogOpen(true);
      setSelectedId(id);
      setDetailLoading(true);
      setReviewRemarks("");
      setReviewDecision("SUSPICIOUS");

      const result = await getSuspiciousAttendanceLogDetail(id);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to load suspicious log detail");
      }

      const row = result.data as SuspiciousLogRow;
      setDetail(row);
      if (row.status === "VALID") {
        setReviewDecision("VALID");
      } else if (row.status === "REJECTED") {
        setReviewDecision("REJECTED");
      } else {
        setReviewDecision("SUSPICIOUS");
      }
      setReviewRemarks(row.remarks ?? "");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load suspicious detail";
      toast.error("Failed to load suspicious log.", {
        description: message,
      });
      setDialogOpen(false);
      setSelectedId(null);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReview = async () => {
    if (!selectedId) return;

    try {
      setReviewing(true);
      const result = await reviewSuspiciousAttendanceLog({
        id: selectedId,
        decision: reviewDecision,
        remarks: reviewRemarks,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to review suspicious log");
      }

      toast.success("Suspicious log updated.", {
        description: "Review decision and remarks were saved.",
      });
      await load();
      await openDetail(selectedId);
    } catch (err) {
      toast.error("Failed to review suspicious log.", {
        description:
          err instanceof Error ? err.message : "Failed to review suspicious log",
      });
    } finally {
      setReviewing(false);
    }
  };

  useEffect(() => {
    void loadEmployees();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Suspicious Logs</CardTitle>
          <p className="text-sm text-muted-foreground">
            Review attendance punches flagged by device, browser, or location rules.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/10 p-4 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Input
                placeholder="Search employee code or name"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="lg:col-span-3">
              <Select
                value={employeeIdFilter || "__all"}
                onValueChange={(value) =>
                  setEmployeeIdFilter(value === "__all" ? "" : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{selectedEmployeeLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All employees</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.employeeId} value={employee.employeeId}>
                      {employee.employeeCode} - {employee.firstName} {employee.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="VALID">Valid</SelectItem>
                  <SelectItem value="SUSPICIOUS">Suspicious</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-1">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-1">
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="lg:col-span-1">
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <div className="lg:col-span-12 flex flex-wrap gap-2">
              <Button onClick={() => void load()}>Apply filters</Button>
              <Button
                variant="outline"
                onClick={() => {
                  const nextStartDate = sevenDaysAgoISO();
                  const nextEndDate = todayISO();
                  setQuery("");
                  setEmployeeIdFilter("");
                  setStatusFilter("__all");
                  setSeverityFilter("__all");
                  setStartDate(nextStartDate);
                  setEndDate(nextEndDate);
                  void load({
                    query: "",
                    employeeId: "",
                    status: "__all",
                    severity: "__all",
                    startDate: nextStartDate,
                    endDate: nextEndDate,
                  });
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          {loading ? (
            <TableLoadingState
              label="Loading suspicious logs"
              columns={7}
              rows={5}
            />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No suspicious attendance logs found for selected filters.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date / Time</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewed By</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {row.employee?.firstName} {row.employee?.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.employee?.employeeCode || row.employeeId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-xl">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{row.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            Rule: {row.detectedByRule}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={severityVariant(row.severity)}>
                          {row.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.status)}>
                          {formatStatusLabel(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.reviewedBy?.username || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => void openDetail(row.id)}>
                          Open details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Suspicious Attendance Detail</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <TableLoadingState label="Loading detail" columns={2} rows={3} />
          ) : detail ? (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="border-dashed">
                  <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Employee
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="font-semibold">
                      {detail.employee?.firstName} {detail.employee?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {detail.employee?.employeeCode || detail.employeeId}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Logged At
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="font-semibold">{formatDateTime(detail.createdAt)}</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Severity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <Badge variant={severityVariant(detail.severity)}>
                      {detail.severity}
                    </Badge>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardHeader className="px-4 pt-4 pb-2">
                    <CardTitle className="text-sm text-muted-foreground">
                      Review Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <Badge variant={statusVariant(detail.status)}>
                      {formatStatusLabel(detail.status)}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Flag Reason</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium">{detail.reason}</p>
                  <p className="text-muted-foreground">
                    Rule: {detail.detectedByRule}
                  </p>
                  {detail.relatedLogs && detail.relatedLogs.length > 1 ? (
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Related flags for same attendance
                      </p>
                      <div className="mt-2 space-y-2">
                        {detail.relatedLogs.map((row) => (
                          <div key={row.id} className="rounded-md border bg-background px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={severityVariant(row.severity)}>
                                {row.severity}
                              </Badge>
                              <Badge variant={statusVariant(row.status)}>
                                {formatStatusLabel(row.status)}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm">{row.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.detectedByRule}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Attendance Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Work date:</span>{" "}
                      {formatDateTime(detail.attendance?.workDate)}
                    </p>
                    <p>
                      <span className="font-medium">Status:</span>{" "}
                      {detail.attendance?.status || "—"}
                    </p>
                    <p>
                      <span className="font-medium">Time in:</span>{" "}
                      {formatDateTime(detail.attendance?.actualInAt)}
                    </p>
                    <p>
                      <span className="font-medium">Time out:</span>{" "}
                      {formatDateTime(detail.attendance?.actualOutAt)}
                    </p>
                    <p>
                      <span className="font-medium">Attendance flagged:</span>{" "}
                      {detail.attendance?.isFlagged ? "Yes" : "No"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Captured Device Data</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Logged punch at:</span>{" "}
                      {formatDateTime(detail.deviceLog?.createdAt)}
                    </p>
                    <p>
                      <span className="font-medium">IP address:</span>{" "}
                      {detail.deviceLog?.ipAddress || "—"}
                    </p>
                    <p>
                      <span className="font-medium">User agent:</span>{" "}
                      {detail.deviceLog?.userAgent || "—"}
                    </p>
                    <p>
                      <span className="font-medium">Device token:</span>{" "}
                      {previewHash(detail.deviceLog?.deviceToken)}
                    </p>
                    <p>
                      <span className="font-medium">Fingerprint:</span>{" "}
                      {previewHash(detail.deviceLog?.fingerprint)}
                    </p>
                    <p>
                      <span className="font-medium">Latitude:</span>{" "}
                      {detail.deviceLog?.latitude ?? "—"}
                    </p>
                    <p>
                      <span className="font-medium">Longitude:</span>{" "}
                      {detail.deviceLog?.longitude ?? "—"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Manager Review</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Decision</label>
                      <Select
                        value={reviewDecision}
                        onValueChange={(value) =>
                          setReviewDecision(
                            value as "VALID" | "SUSPICIOUS" | "REJECTED",
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VALID">Valid</SelectItem>
                          <SelectItem value="SUSPICIOUS">Suspicious</SelectItem>
                          <SelectItem value="REJECTED">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reviewed by</label>
                      <div className="rounded-md border bg-muted/10 px-3 py-2 text-sm">
                        {detail.reviewedBy?.username || "Not reviewed yet"}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Remarks</label>
                    <textarea
                      value={reviewRemarks}
                      onChange={(event) => setReviewRemarks(event.target.value)}
                      rows={4}
                      className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Add review remarks for audit trail."
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Close
                    </Button>
                    <Button onClick={() => void handleReview()} disabled={reviewing}>
                      {reviewing ? "Saving..." : "Save review"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No suspicious log selected.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
