"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getViolations,
  type ViolationRow,
} from "@/actions/violations/violations-action";
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
import { TableLoadingState } from "@/components/loading/loading-states";
import { useSession } from "@/hooks/use-session";
import ViolationCreateForm from "./violation-create-form";

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

const SupervisorViolationsPage = () => {
  const { user, loading: sessionLoading } = useSession();
  const [rows, setRows] = useState<ViolationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user?.userId) return;

    try {
      setLoading(true);
      setError(null);
      const result = await getViolations();
      if (!result.success) {
        throw new Error(result.error || "Failed to load violation drafts");
      }

      const filteredRows = (result.data ?? []).filter(
        (row) => row.draftedById === user.userId,
      );
      setRows(filteredRows);
    } catch (err) {
      setRows([]);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load supervisor violations",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, user?.userId]);

  const draftCount = useMemo(
    () => rows.filter((row) => row.status === "DRAFT").length,
    [rows],
  );
  const approvedCount = useMemo(
    () => rows.filter((row) => row.status === "APPROVED").length,
    [rows],
  );
  const rejectedCount = useMemo(
    () => rows.filter((row) => row.status === "REJECTED").length,
    [rows],
  );

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">Supervisor Violations</h1>
        <p className="text-sm text-muted-foreground">
          Draft employee violations for manager review and approval.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ViolationCreateForm
          cancelPath="/supervisor/violations"
          onSubmitted={() => load()}
        />

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Draft
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{draftCount}</p>
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
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">My Violation Drafts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Violation</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Manager Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-3">
                      <TableLoadingState
                        label="Loading drafts"
                        columns={5}
                        rows={3}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading && error ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-destructive">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading && !error && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No violation drafts yet.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading &&
                  !error &&
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.employeeName}
                        <p className="text-xs text-muted-foreground">
                          {row.employeeCode}
                        </p>
                      </TableCell>
                      <TableCell>{row.violationName}</TableCell>
                      <TableCell>{formatDate(row.violationDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(row.status)}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.reviewRemarks || "No note"}
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

export default SupervisorViolationsPage;
