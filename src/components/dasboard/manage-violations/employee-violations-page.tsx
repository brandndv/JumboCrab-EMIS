"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getEmployeeViolationStrikeProgress,
  getViolations,
  setEmployeeViolationAcknowledged,
  type ViolationStrikeProgressRow,
  type ViolationRow,
} from "@/actions/violations/violations-action";
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
import { useSession } from "@/hooks/use-session";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const statusClass = (status: ViolationRow["status"]) => {
  if (status === "APPROVED") return "border-emerald-600 text-emerald-700";
  if (status === "REJECTED") return "border-destructive text-destructive";
  return "border-orange-600 text-orange-700";
};

const EmployeeViolationsPage = () => {
  const { employee, loading: sessionLoading } = useSession();
  const [rows, setRows] = useState<ViolationRow[]>([]);
  const [strikeProgress, setStrikeProgress] = useState<ViolationStrikeProgressRow[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [strikeLoading, setStrikeLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strikeError, setStrikeError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const load = async () => {
    if (!employee?.employeeId) {
      setRows([]);
      setStrikeProgress([]);
      setLoading(false);
      setStrikeLoading(false);
      return;
    }

    try {
      setLoading(true);
      setStrikeLoading(true);
      setError(null);
      setStrikeError(null);

      const [violationsResult, strikeResult] = await Promise.all([
        getViolations({ employeeId: employee.employeeId }),
        getEmployeeViolationStrikeProgress({ employeeId: employee.employeeId }),
      ]);

      if (!violationsResult.success) {
        setRows([]);
        setError(violationsResult.error || "Failed to load your violations");
      } else {
        setRows(violationsResult.data ?? []);
      }

      if (!strikeResult.success) {
        setStrikeProgress([]);
        setStrikeError(strikeResult.error || "Failed to load strike progress");
      } else {
        setStrikeProgress(strikeResult.data ?? []);
      }
    } catch (err) {
      setRows([]);
      setStrikeProgress([]);
      setError(
        err instanceof Error ? err.message : "Failed to load your violations",
      );
      setStrikeError(
        err instanceof Error ? err.message : "Failed to load strike progress",
      );
    } finally {
      setLoading(false);
      setStrikeLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, employee?.employeeId]);

  const unacknowledgedCount = useMemo(
    () => rows.filter((row) => !row.isAcknowledged).length,
    [rows],
  );
  const approvedCount = useMemo(
    () => rows.filter((row) => row.status === "APPROVED").length,
    [rows],
  );
  const countedStrikesTotal = useMemo(
    () =>
      strikeProgress.reduce(
        (total, row) => total + row.currentCountedStrikes,
        0,
      ),
    [strikeProgress],
  );

  const acknowledge = async (id: string) => {
    try {
      setAcknowledgingId(id);
      const result = await setEmployeeViolationAcknowledged({
        id,
        isAcknowledged: true,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to acknowledge violation");
      }
      setRows((previous) =>
        previous.map((row) =>
          row.id === id ? { ...row, ...(result.data ?? {}) } : row,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to acknowledge violation",
      );
    } finally {
      setAcknowledgingId(null);
    }
  };

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">My Violations</h1>
        <p className="text-sm text-muted-foreground">
          Review your violation records and acknowledge pending items.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              Unacknowledged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{unacknowledgedCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Counted Strikes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{countedStrikesTotal}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Strike Progress</CardTitle>
          <p className="text-sm text-muted-foreground">
            Current counted strikes per violation type against the allowed cap.
          </p>
        </CardHeader>
        <CardContent>
          {strikeLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading strike progress...
            </p>
          ) : strikeError ? (
            <p className="text-sm text-destructive">{strikeError}</p>
          ) : strikeProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No committed violation types yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {strikeProgress.map((item) => {
                const pct = Math.min(
                  100,
                  Math.round(
                    (item.currentCountedStrikes /
                      Math.max(1, item.maxStrikesPerEmployee)) *
                      100,
                  ),
                );

                return (
                  <div
                    key={item.violationId}
                    className="rounded-lg border bg-background/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{item.violationName}</p>
                      <Badge variant="outline">{item.progressLabel}</Badge>
                    </div>
                    <div className="mt-2 h-2 w-full rounded bg-muted">
                      <div
                        className="h-2 rounded bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">Violation History</CardTitle>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Violation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Strike Points</TableHead>
                  <TableHead>Acknowledgement</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Loading your violations...
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
                {!loading && !error && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No violations found.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading &&
                  !error &&
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.violationDate)}</TableCell>
                      <TableCell>
                        <p className="font-medium">{row.violationName}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.remarks || "No remarks"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(row.status)}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.strikePointsSnapshot}</TableCell>
                      <TableCell>
                        {row.isAcknowledged ? (
                          <span className="text-emerald-700">Acknowledged</span>
                        ) : (
                          <span className="text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!row.isAcknowledged && row.status === "APPROVED" ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void acknowledge(row.id)}
                            disabled={acknowledgingId === row.id}
                          >
                            Acknowledge
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
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
};

export default EmployeeViolationsPage;
