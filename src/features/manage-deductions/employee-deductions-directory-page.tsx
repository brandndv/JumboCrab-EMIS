"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  listEmployeeDeductionAssignments,
  listEmployeesForDeduction,
  setEmployeeDeductionAssignmentStatus,
  type DeductionAssignmentRow,
  type DeductionEmployeeOption,
} from "@/actions/deductions/deductions-action";
import {
  amountModeLabel,
  describeAssignmentValue,
  formatDate,
  formatEmployeeLabel,
  formatMoney,
  frequencyLabel,
  runtimeStatusClass,
  runtimeStatusLabel,
  workflowStatusClass,
  workflowStatusLabel,
} from "@/features/manage-deductions/deduction-ui-helpers";
import { DeductionProgress } from "@/features/manage-deductions/deduction-progress";
import { DeductionPaymentDialog } from "@/features/manage-deductions/installment-payment-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { EmployeeDeductionAssignmentStatus } from "@prisma/client";

type EmployeeDeductionsDirectoryPageProps = {
  rolePath: "admin" | "generalManager" | "manager";
  canManageAssignments?: boolean;
};

const isOngoingAssignment = (row: DeductionAssignmentRow) => {
  if (row.workflowStatus !== "APPROVED") return false;
  if (
    row.status === EmployeeDeductionAssignmentStatus.COMPLETED ||
    row.status === EmployeeDeductionAssignmentStatus.CANCELLED
  ) {
    return false;
  }

  if (row.frequency !== "INSTALLMENT") return true;

  const balanceSeed = row.remainingBalance ?? row.installmentTotal;
  return typeof balanceSeed === "number" ? balanceSeed > 0 : true;
};

export default function EmployeeDeductionsDirectoryPage({
  rolePath,
  canManageAssignments = false,
}: EmployeeDeductionsDirectoryPageProps) {
  return (
    <Suspense
      fallback={
        <EmployeeDeductionsDirectoryFallback
          rolePath={rolePath}
          canManageAssignments={canManageAssignments}
        />
      }
    >
      <EmployeeDeductionsDirectoryPageContent
        rolePath={rolePath}
        canManageAssignments={canManageAssignments}
      />
    </Suspense>
  );
}

function EmployeeDeductionsDirectoryFallback({
  rolePath,
  canManageAssignments = false,
}: EmployeeDeductionsDirectoryPageProps) {
  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employee Deductions</h1>
          <p className="text-sm text-muted-foreground">
            View current and past deduction assignments per employee.
          </p>
        </div>
        {canManageAssignments ? (
          <Button asChild type="button">
            <Link href={`/${rolePath}/deductions/add`}>Assign Deduction</Link>
          </Button>
        ) : null}
      </div>

      <Card className="shadow-sm">
        <CardContent className="py-10">
          <p className="text-sm text-muted-foreground">Loading employee deductions...</p>
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeDeductionsDirectoryPageContent({
  rolePath,
  canManageAssignments = false,
}: EmployeeDeductionsDirectoryPageProps) {
  const searchParams = useSearchParams();
  const [employees, setEmployees] = useState<DeductionEmployeeOption[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    searchParams.get("employeeId") ?? "",
  );
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const [rows, setRows] = useState<DeductionAssignmentRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const employeeSuggestions = useMemo(() => {
    const term = employeeQuery.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      formatEmployeeLabel(employee).toLowerCase().includes(term),
    );
  }, [employeeQuery, employees]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.employeeId === selectedEmployeeId),
    [employees, selectedEmployeeId],
  );
  const showingSelectedEmployee = Boolean(selectedEmployeeId);
  const visibleRows = useMemo(
    () => (showingSelectedEmployee ? rows : rows.filter(isOngoingAssignment)),
    [rows, showingSelectedEmployee],
  );

  const ongoingCount = useMemo(
    () => rows.filter(isOngoingAssignment).length,
    [rows],
  );
  const completedCount = useMemo(
    () =>
      rows.filter((row) => {
        if (row.workflowStatus !== "APPROVED") return false;
        if (row.status === EmployeeDeductionAssignmentStatus.COMPLETED) {
          return true;
        }

        if (row.frequency !== "INSTALLMENT") return false;

        const balanceSeed = row.remainingBalance ?? row.installmentTotal;
        return typeof balanceSeed === "number" ? balanceSeed <= 0 : false;
      }).length,
    [rows],
  );
  const installmentCount = useMemo(
    () =>
      rows.filter((row) => {
        if (row.workflowStatus !== "APPROVED") return false;
        if (row.frequency !== "INSTALLMENT") return false;
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

  const loadEmployees = async (query: string) => {
    try {
      setEmployeesLoading(true);
      const result = await listEmployeesForDeduction({
        query,
        employeeId: selectedEmployeeId || undefined,
        limit: 80,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to load employees");
      }
      const data = result.data ?? [];
      setEmployees(data);
      const selected = data.find((row) => row.employeeId === selectedEmployeeId);
      if (selected && !employeeQuery) {
        setEmployeeQuery(formatEmployeeLabel(selected));
      }
    } catch (err) {
      setEmployees([]);
      setError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const loadAssignments = async (employeeId: string) => {
    try {
      setLoadingRows(true);
      setError(null);
      const result = await listEmployeeDeductionAssignments(
        employeeId
          ? { employeeId, directoryMode: true }
          : {
              workflowStatuses: ["APPROVED"],
              limit: 200,
              directoryMode: true,
            },
      );
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
      setLoadingRows(false);
    }
  };

  const updateStatus = async (
    id: string,
    nextStatus: EmployeeDeductionAssignmentStatus,
  ) => {
    try {
      setUpdatingStatusId(id);
      setError(null);
      const result = await setEmployeeDeductionAssignmentStatus({
        id,
        status: nextStatus,
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to update deduction status");
      }
      setRows((current) =>
        current.map((row) => (row.id === id ? result.data! : row)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update deduction status",
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const selectEmployee = (employee: DeductionEmployeeOption) => {
    setSelectedEmployeeId(employee.employeeId);
    setEmployeeQuery(formatEmployeeLabel(employee));
    setEmployeeDropdownOpen(false);
  };

  const replaceRow = (nextRow: DeductionAssignmentRow) => {
    setRows((current) =>
      current.map((row) => (row.id === nextRow.id ? nextRow : row)),
    );
  };

  useEffect(() => {
    void loadEmployees("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadEmployees(employeeQuery);
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeQuery]);

  useEffect(() => {
    void loadAssignments(selectedEmployeeId);
  }, [selectedEmployeeId]);

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employee Deductions</h1>
          <p className="text-sm text-muted-foreground">
            View current and past deduction assignments per employee.
          </p>
        </div>
        {canManageAssignments ? (
          <Button asChild type="button">
            <Link href={`/${rolePath}/deductions/add`}>Assign Deduction</Link>
          </Button>
        ) : null}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Select Employee</CardTitle>
          <p className="text-sm text-muted-foreground">
            Search and select an employee to load all deduction assignments for
            that employee, or review ongoing approved deductions below.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              value={employeeQuery}
              onChange={(event) => {
                setEmployeeQuery(event.target.value);
                setSelectedEmployeeId("");
                setEmployeeDropdownOpen(true);
              }}
              onFocus={() => setEmployeeDropdownOpen(true)}
              onBlur={() => {
                setTimeout(() => setEmployeeDropdownOpen(false), 120);
              }}
              placeholder={
                employeesLoading ? "Loading employees..." : "Search employee"
              }
            />
            {employeeDropdownOpen && employeeSuggestions.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                {employeeSuggestions.slice(0, 20).map((employee) => (
                  <button
                    key={employee.employeeId}
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectEmployee(employee);
                    }}
                  >
                    {formatEmployeeLabel(employee)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {selectedEmployee ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="border-border/70 shadow-none">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    Total Assignments
                  </p>
                  <p className="text-2xl font-semibold">{rows.length}</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-none">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Ongoing</p>
                  <p className="text-2xl font-semibold">{ongoingCount}</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-none">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-semibold">{completedCount}</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-none">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Open Installments</p>
                  <p className="text-2xl font-semibold">{installmentCount}</p>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedEmployee ? "Assignments" : "Ongoing Assignments"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedEmployee ? (
            <div className="mb-4 flex items-center gap-3">
              <Avatar className="h-11 w-11">
                {rows[0]?.avatarUrl ? (
                  <AvatarImage src={rows[0].avatarUrl ?? undefined} />
                ) : null}
                <AvatarFallback>
                  {selectedEmployee.firstName[0]}
                  {selectedEmployee.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedEmployee.employeeCode}
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {!selectedEmployee ? <TableHead>Employee</TableHead> : null}
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Payroll Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingRows ? (
                  <TableRow>
                    <TableCell
                      colSpan={selectedEmployee ? 8 : 9}
                      className="text-muted-foreground"
                    >
                      Loading assignments...
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loadingRows && !selectedEmployee && visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-muted-foreground"
                    >
                      No ongoing deductions found. Select an employee to view
                      full deduction history.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loadingRows && selectedEmployee && visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-muted-foreground"
                    >
                      No deduction assignments found for this employee.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loadingRows &&
                  visibleRows.map((row) => (
                    <TableRow key={row.id}>
                      {!selectedEmployee ? (
                        <TableCell className="min-w-48">
                          <div className="font-medium">{row.employeeName}</div>
                          <p className="text-xs text-muted-foreground">
                            {row.employeeCode}
                          </p>
                        </TableCell>
                      ) : null}
                      <TableCell className="min-w-52">
                        <div className="font-medium">{row.deductionName}</div>
                        <p className="text-xs text-muted-foreground">
                          {amountModeLabel(row.amountMode)} •{" "}
                          {frequencyLabel(row.frequency)}
                        </p>
                      </TableCell>
                      <TableCell>{describeAssignmentValue(row)}</TableCell>
                      <TableCell className="min-w-48">
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
                          className={workflowStatusClass(row.workflowStatus)}
                        >
                          {workflowStatusLabel(row.workflowStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {canManageAssignments &&
                        row.workflowStatus === "APPROVED" ? (
                          <select
                            value={row.status}
                            onChange={(event) =>
                              void updateStatus(
                                row.id,
                                event.target.value as EmployeeDeductionAssignmentStatus,
                              )
                            }
                            disabled={updatingStatusId === row.id}
                            className="h-9 rounded-md border bg-background px-2 text-sm"
                          >
                            <option value={EmployeeDeductionAssignmentStatus.ACTIVE}>
                              Active
                            </option>
                            <option value={EmployeeDeductionAssignmentStatus.PAUSED}>
                              Paused
                            </option>
                            <option value={EmployeeDeductionAssignmentStatus.COMPLETED}>
                              Completed
                            </option>
                            <option value={EmployeeDeductionAssignmentStatus.CANCELLED}>
                              Cancelled
                            </option>
                          </select>
                        ) : (
                          <Badge
                            variant="outline"
                            className={runtimeStatusClass(row.status)}
                          >
                            {runtimeStatusLabel(row.status)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[18rem]">
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {row.reason || "No reason provided"}
                        </p>
                        {row.reviewRemarks ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            Review: {row.reviewRemarks}
                          </p>
                        ) : null}
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {row.frequency === "INSTALLMENT" ? (
                            <p>
                              Remaining {formatMoney(row.remainingBalance ?? 0)}
                            </p>
                          ) : row.frequency === "ONE_TIME" ? (
                            <p>
                              One-time deductions can be settled manually before payroll release.
                            </p>
                          ) : (
                            <p>
                              Recurring deductions can log manual payments and still stay active.
                            </p>
                          )}
                          {row.payments[0] ? (
                            <p>
                              Last payment {formatMoney(row.payments[0].amount)} on{" "}
                              {formatDate(row.payments[0].paymentDate)}
                            </p>
                          ) : (
                            <p>No manual payments recorded yet.</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageAssignments &&
                        row.workflowStatus === "APPROVED" ? (
                          <div className="flex justify-end gap-2">
                            <DeductionPaymentDialog row={row} onRecorded={replaceRow} />
                            <Button asChild size="sm" variant="ghost">
                              <Link
                                href={`/${rolePath}/deductions/add?assignmentId=${row.id}`}
                              >
                                Edit
                              </Link>
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            View only
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
}
