"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import {
  ModuleLoadingState,
  TableLoadingState,
} from "@/components/loading/loading-states";
import { Input } from "@/components/ui/input";
import { ChevronDown } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast-provider";
import {
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
} from "@prisma/client";

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

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type DirectorySummarySort =
  | "count-desc"
  | "count-asc"
  | "name-asc"
  | "name-desc";

type EmployeeDeductionSummaryRow = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  ongoingCount: number;
  installmentCount: number;
  recurringCount: number;
  oneTimeCount: number;
};

export default function EmployeeDeductionsDirectoryPage({
  rolePath,
  canManageAssignments = false,
}: EmployeeDeductionsDirectoryPageProps) {
  return (
    <Suspense fallback={<EmployeeDeductionsDirectoryFallback />}>
      <EmployeeDeductionsDirectoryPageContent
        rolePath={rolePath}
        canManageAssignments={canManageAssignments}
      />
    </Suspense>
  );
}

function EmployeeDeductionsDirectoryFallback() {
  return (
    <ModuleLoadingState
      title="Employee Deductions"
      description="View current and past deduction assignments per employee."
      cardCount={4}
    />
  );
}

function EmployeeDeductionsDirectoryPageContent({
  rolePath,
  canManageAssignments = false,
}: EmployeeDeductionsDirectoryPageProps) {
  const searchParams = useSearchParams();
  const toast = useToast();
  const [employees, setEmployees] = useState<DeductionEmployeeOption[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    searchParams.get("employeeId") ?? "",
  );
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [hasLoadedEmployees, setHasLoadedEmployees] = useState(false);
  const employeeSearchActivatedRef = useRef(false);

  const [rows, setRows] = useState<DeductionAssignmentRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [hasLoadedAssignments, setHasLoadedAssignments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [summarySort, setSummarySort] =
    useState<DirectorySummarySort>("count-desc");
  const [summaryDepartment, setSummaryDepartment] = useState("all");
  const [summaryPagination, setSummaryPagination] = useState<{
    datasetKey: string;
    page: number;
    pageSize: number;
  }>({
    datasetKey: "",
    page: 1,
    pageSize: PAGE_SIZE_OPTIONS[0],
  });

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
  const employeeSummaryRows = useMemo(() => {
    const summaryMap = new Map<string, EmployeeDeductionSummaryRow>();

    for (const row of rows.filter(isOngoingAssignment)) {
      const existing = summaryMap.get(row.employeeId);
      const departmentName = row.departmentName?.trim() || "Unassigned";

      if (existing) {
        existing.ongoingCount += 1;
        if (row.frequency === DeductionFrequency.INSTALLMENT) {
          existing.installmentCount += 1;
        } else if (row.frequency === DeductionFrequency.ONE_TIME) {
          existing.oneTimeCount += 1;
        } else {
          existing.recurringCount += 1;
        }
        continue;
      }

      summaryMap.set(row.employeeId, {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        employeeCode: row.employeeCode,
        departmentName,
        ongoingCount: 1,
        installmentCount:
          row.frequency === DeductionFrequency.INSTALLMENT ? 1 : 0,
        recurringCount:
          row.frequency === DeductionFrequency.PER_PAYROLL ? 1 : 0,
        oneTimeCount: row.frequency === DeductionFrequency.ONE_TIME ? 1 : 0,
      });
    }

    const items = Array.from(summaryMap.values());
    if (summaryDepartment !== "all") {
      return items.filter((row) => row.departmentName === summaryDepartment);
    }
    return items;
  }, [rows, summaryDepartment]);
  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.departmentName?.trim() || "Unassigned")
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const sortedEmployeeSummaryRows = useMemo(() => {
    const items = [...employeeSummaryRows];
    items.sort((a, b) => {
      switch (summarySort) {
        case "count-asc":
          return (
            a.ongoingCount - b.ongoingCount ||
            a.employeeName.localeCompare(b.employeeName)
          );
        case "name-asc":
          return a.employeeName.localeCompare(b.employeeName);
        case "name-desc":
          return b.employeeName.localeCompare(a.employeeName);
        default:
          return (
            b.ongoingCount - a.ongoingCount ||
            a.employeeName.localeCompare(b.employeeName)
          );
      }
    });
    return items;
  }, [employeeSummaryRows, summarySort]);
  const summaryDatasetKey = useMemo(
    () =>
      sortedEmployeeSummaryRows
        .map((row) => `${row.employeeId}:${row.ongoingCount}`)
        .join("|"),
    [sortedEmployeeSummaryRows],
  );
  const summaryPageSize = summaryPagination.pageSize;
  const summaryCurrentPage =
    summaryPagination.datasetKey === summaryDatasetKey
      ? summaryPagination.page
      : 1;
  const summaryTotalPages = Math.max(
    1,
    Math.ceil(sortedEmployeeSummaryRows.length / summaryPageSize),
  );
  const safeSummaryPage = Math.min(summaryCurrentPage, summaryTotalPages);
  const summaryPageStart = (safeSummaryPage - 1) * summaryPageSize;
  const paginatedSummaryRows = sortedEmployeeSummaryRows.slice(
    summaryPageStart,
    summaryPageStart + summaryPageSize,
  );
  const summaryShowingFrom =
    sortedEmployeeSummaryRows.length === 0 ? 0 : summaryPageStart + 1;
  const summaryShowingTo =
    sortedEmployeeSummaryRows.length === 0
      ? 0
      : Math.min(
          summaryPageStart + summaryPageSize,
          sortedEmployeeSummaryRows.length,
        );
  const visibleSummaryPageNumbers = useMemo(() => {
    if (summaryTotalPages <= 5) {
      return Array.from({ length: summaryTotalPages }, (_, index) => index + 1);
    }

    const start = Math.max(1, safeSummaryPage - 1);
    const end = Math.min(summaryTotalPages, start + 2);
    const adjustedStart = Math.max(1, end - 2);

    return Array.from(
      { length: end - adjustedStart + 1 },
      (_, index) => adjustedStart + index,
    );
  }, [safeSummaryPage, summaryTotalPages]);

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
      setHasLoadedEmployees(true);
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
      setHasLoadedAssignments(true);
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
      toast.success("Deduction status updated successfully.", {
        description: `Status changed to ${runtimeStatusLabel(nextStatus)}.`,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update deduction status";
      setError(message);
      toast.error("Failed to update deduction status.", {
        description: message,
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const selectEmployee = (employee: DeductionEmployeeOption) => {
    setSelectedEmployeeId(employee.employeeId);
    setEmployeeQuery(formatEmployeeLabel(employee));
    setEmployeeDropdownOpen(false);
  };

  const selectSummaryEmployee = (row: EmployeeDeductionSummaryRow) => {
    const employee = employees.find(
      (candidate) => candidate.employeeId === row.employeeId,
    );

    if (employee) {
      selectEmployee(employee);
      return;
    }

    setSelectedEmployeeId(row.employeeId);
    setEmployeeQuery(`${row.employeeName} • ${row.employeeCode}`);
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
    if (!employeeSearchActivatedRef.current) {
      return;
    }

    const handle = setTimeout(() => {
      void loadEmployees(employeeQuery);
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeQuery]);

  useEffect(() => {
    void loadAssignments(selectedEmployeeId);
  }, [selectedEmployeeId]);

  const isInitialPageLoading =
    !error && (!hasLoadedEmployees || !hasLoadedAssignments);

  if (isInitialPageLoading) {
    return (
      <ModuleLoadingState
        title="Employee Deductions"
        description="Loading employee selections and deduction assignments."
      />
    );
  }

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
                employeeSearchActivatedRef.current = true;
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

      {!selectedEmployee ? (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-lg">Employee Deduction Counts</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ranked summary of employees with ongoing approved deductions.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">Sort by</span>
                <select
                  value={summarySort}
                  onChange={(event) => {
                    const nextSort = event.target.value as DirectorySummarySort;
                    setSummarySort(nextSort);
                    setSummaryPagination((prev) => ({
                      ...prev,
                      datasetKey: summaryDatasetKey,
                      page: 1,
                    }));
                  }}
                  className="h-10 min-w-52 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="count-desc">Highest to lowest</option>
                  <option value="count-asc">Lowest to highest</option>
                  <option value="name-asc">Employee A-Z</option>
                  <option value="name-desc">Employee Z-A</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">Department</span>
                <select
                  value={summaryDepartment}
                  onChange={(event) => {
                    setSummaryDepartment(event.target.value);
                    setSummaryPagination((prev) => ({
                      ...prev,
                      datasetKey: summaryDatasetKey,
                      page: 1,
                    }));
                  }}
                  className="h-10 min-w-52 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">All departments</option>
                  {departmentOptions.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Ongoing</TableHead>
                    <TableHead className="text-right">Installment</TableHead>
                    <TableHead className="text-right">Recurring</TableHead>
                    <TableHead className="text-right">One-time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingRows ? (
                    <TableRow>
                      <TableCell colSpan={6} className="p-3">
                        <TableLoadingState
                          label="Loading employee deduction counts"
                          columns={6}
                          rows={5}
                        />
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!loadingRows && paginatedSummaryRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        No employees match the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!loadingRows &&
                    paginatedSummaryRows.map((row) => (
                      <TableRow
                        key={row.employeeId}
                        role="button"
                        tabIndex={0}
                        aria-label={`View deduction assignments for ${row.employeeName}`}
                        className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                        onClick={() => selectSummaryEmployee(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectSummaryEmployee(row);
                          }
                        }}
                      >
                        <TableCell className="min-w-56">
                          <div className="font-medium">{row.employeeName}</div>
                          <p className="text-xs text-muted-foreground">
                            {row.employeeCode}
                          </p>
                        </TableCell>
                        <TableCell>{row.departmentName}</TableCell>
                        <TableCell className="text-right font-medium">
                          {row.ongoingCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.installmentCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.recurringCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.oneTimeCount}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {sortedEmployeeSummaryRows.length === 0
                  ? "Showing 0 of 0 employees"
                  : `Showing ${summaryShowingFrom}-${summaryShowingTo} of ${sortedEmployeeSummaryRows.length} employees`}
              </p>

              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <label className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="whitespace-nowrap">Rows per page</span>
                  <span className="relative">
                    <select
                      value={summaryPageSize}
                      onChange={(event) => {
                        setSummaryPagination((prev) => ({
                          ...prev,
                          datasetKey: summaryDatasetKey,
                          page: 1,
                          pageSize: Number(event.target.value),
                        }));
                      }}
                      className="h-10 min-w-[72px] appearance-none rounded-md border border-border bg-background px-3 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </span>
                </label>

                {summaryTotalPages > 1 ? (
                  <Pagination className="m-0 w-auto justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (safeSummaryPage > 1) {
                              setSummaryPagination((prev) => ({
                                ...prev,
                                datasetKey: summaryDatasetKey,
                                page: safeSummaryPage - 1,
                              }));
                            }
                          }}
                          className={
                            safeSummaryPage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>

                      {visibleSummaryPageNumbers[0] > 1 ? (
                        <>
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              onClick={(event) => {
                                event.preventDefault();
                                setSummaryPagination((prev) => ({
                                  ...prev,
                                  datasetKey: summaryDatasetKey,
                                  page: 1,
                                }));
                              }}
                              className="cursor-pointer"
                            >
                              1
                            </PaginationLink>
                          </PaginationItem>
                          {visibleSummaryPageNumbers[0] > 2 ? (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : null}
                        </>
                      ) : null}

                      {visibleSummaryPageNumbers.map((pageNumber) => (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              setSummaryPagination((prev) => ({
                                ...prev,
                                datasetKey: summaryDatasetKey,
                                page: pageNumber,
                              }));
                            }}
                            isActive={safeSummaryPage === pageNumber}
                            className="cursor-pointer"
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      ))}

                      {visibleSummaryPageNumbers[
                        visibleSummaryPageNumbers.length - 1
                      ] < summaryTotalPages ? (
                        <>
                          {visibleSummaryPageNumbers[
                            visibleSummaryPageNumbers.length - 1
                          ] <
                          summaryTotalPages - 1 ? (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : null}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              onClick={(event) => {
                                event.preventDefault();
                                setSummaryPagination((prev) => ({
                                  ...prev,
                                  datasetKey: summaryDatasetKey,
                                  page: summaryTotalPages,
                                }));
                              }}
                              className="cursor-pointer"
                            >
                              {summaryTotalPages}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      ) : null}

                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            if (safeSummaryPage < summaryTotalPages) {
                              setSummaryPagination((prev) => ({
                                ...prev,
                                datasetKey: summaryDatasetKey,
                                page: safeSummaryPage + 1,
                              }));
                            }
                          }}
                          className={
                            safeSummaryPage === summaryTotalPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
                  <TableHead className="min-w-40">Payroll Status</TableHead>
                  <TableHead className="min-w-80">Reason</TableHead>
                  <TableHead className="min-w-48 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingRows ? (
                  <TableRow>
                    <TableCell colSpan={selectedEmployee ? 8 : 9} className="p-3">
                      <TableLoadingState
                        label="Loading assignments"
                        columns={selectedEmployee ? 8 : 9}
                        rows={4}
                      />
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
                      <TableCell className="min-w-40">
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
                      <TableCell className="min-w-80 max-w-[22rem] align-top">
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
                      <TableCell className="min-w-48 text-right align-top">
                        {canManageAssignments &&
                        row.workflowStatus === "APPROVED" ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            <DeductionPaymentDialog row={row} onRecorded={replaceRow} />
                            <Button asChild size="sm" variant="ghost" className="whitespace-nowrap">
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
