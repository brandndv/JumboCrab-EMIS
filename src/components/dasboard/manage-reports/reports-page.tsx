"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAccountsReport,
  getAttendanceReport,
  getContributionsReport,
  getDeductionsReport,
  getEmployeeInformationReport,
  getPayrollReport,
  getViolationsReport,
  listReportFilterOptions,
  type AccountsReportRow,
  type AccountsReportSummary,
  type AttendanceReportRow,
  type AttendanceReportSummary,
  type ContributionsReportRow,
  type ContributionsReportSummary,
  type DeductionsReportRow,
  type DeductionsReportSummary,
  type EmployeeInformationReportRow,
  type EmployeeInformationReportSummary,
  type PayrollReportRow,
  type PayrollReportSummary,
  type ReportFilterOptions,
  type ViolationsReportRow,
  type ViolationsReportSummary,
} from "@/actions/reports/reports-action";
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
import { InlineLoadingState } from "@/components/loading/loading-states";
import { cn } from "@/lib/utils";
import { openReportPdf } from "./report-pdf";
import ReportsFilterBar from "./reports-filter-bar";
import {
  EMPTY_REPORT_FILTERS,
  formatAttendanceStatusLabel,
  formatDeductionFrequencyLabel,
  formatHoursFromMinutes,
  formatMoney,
  formatPayrollTypeLabel,
  formatReportDate,
  formatReportDateTime,
  formatRoleLabel,
  formatRuntimeStatusLabel,
  formatWorkflowStatusLabel,
  REPORT_DEFINITIONS,
  type ReportFilterDraft,
  type ReportType,
} from "./report-ui-helpers";

type ReportsPageProps = {
  reportType: ReportType;
};

type AttendancePayload = {
  kind: "attendance";
  summary: AttendanceReportSummary;
  rows: AttendanceReportRow[];
  total: number;
};

type AccountsPayload = {
  kind: "accounts";
  summary: AccountsReportSummary;
  rows: AccountsReportRow[];
  total: number;
};

type EmployeeInformationPayload = {
  kind: "employee-information";
  summary: EmployeeInformationReportSummary;
  rows: EmployeeInformationReportRow[];
  total: number;
};

type ContributionsPayload = {
  kind: "contributions";
  summary: ContributionsReportSummary;
  rows: ContributionsReportRow[];
  total: number;
};

type DeductionsPayload = {
  kind: "deductions";
  summary: DeductionsReportSummary;
  rows: DeductionsReportRow[];
  total: number;
};

type ViolationsPayload = {
  kind: "violations";
  summary: ViolationsReportSummary;
  rows: ViolationsReportRow[];
  total: number;
};

type PayrollPayload = {
  kind: "payroll";
  summary: PayrollReportSummary;
  rows: PayrollReportRow[];
  total: number;
};

type ReportPayload =
  | AttendancePayload
  | AccountsPayload
  | EmployeeInformationPayload
  | ContributionsPayload
  | DeductionsPayload
  | ViolationsPayload
  | PayrollPayload;

type SummaryCard = {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
};

type SummaryBreakdown = {
  title: string;
  items: Array<{
    label: string;
    value: React.ReactNode;
  }>;
};

const badgeClass = (tone: "default" | "success" | "warning" | "danger") => {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "danger":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

const getSearchPlaceholder = (reportType: ReportType) => {
  switch (reportType) {
    case "attendance":
      return "Search employee code, employee name, or expected shift";
    case "accounts":
      return "Search username, email, or linked employee";
    case "employee-information":
      return "Search employee code, employee name, department, position, email, or phone";
    case "contributions":
      return "Search employee code or employee name";
    case "deductions":
      return "Search employee or deduction type";
    case "violations":
      return "Search employee or violation type";
    case "payroll":
      return "Search employee code or employee name";
    default:
      return "Search records";
  }
};

const renderBooleanBadge = (label: string, value: boolean) => (
  <Badge className={badgeClass(value ? "success" : "default")}>
    {label}: {value ? "Yes" : "No"}
  </Badge>
);

export default function ReportsPage({
  reportType,
}: ReportsPageProps) {
  const report = REPORT_DEFINITIONS[reportType];
  const [filters, setFilters] = useState<ReportFilterDraft>(EMPTY_REPORT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<ReportFilterDraft>(EMPTY_REPORT_FILTERS);
  const [options, setOptions] = useState<ReportFilterOptions | null>(null);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadFilterOptions = async () => {
      try {
        setLoadingFilters(true);
        const result = await listReportFilterOptions();
        if (cancelled) return;
        if (!result.success) {
          throw new Error(result.error || "Failed to load filters");
        }
        setOptions(result.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load filters.");
        }
      } finally {
        if (!cancelled) {
          setLoadingFilters(false);
        }
      }
    };

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadReport = async () => {
      try {
        setLoading(true);
        setError(null);

        if (reportType === "attendance") {
          const result = await getAttendanceReport(appliedFilters);
          if (!result.success) {
            throw new Error(result.error || "Failed to load attendance report");
          }
          if (!cancelled) {
            setData({ kind: "attendance", ...result.data });
          }
          return;
        }

        if (reportType === "accounts") {
          const result = await getAccountsReport(appliedFilters);
          if (!result.success) {
            throw new Error(result.error || "Failed to load accounts report");
          }
          if (!cancelled) {
            setData({ kind: "accounts", ...result.data });
          }
          return;
        }

        if (reportType === "employee-information") {
          const result = await getEmployeeInformationReport(appliedFilters);
          if (!result.success) {
            throw new Error(
              result.error || "Failed to load employee information report",
            );
          }
          if (!cancelled) {
            setData({ kind: "employee-information", ...result.data });
          }
          return;
        }

        if (reportType === "contributions") {
          const result = await getContributionsReport(appliedFilters);
          if (!result.success) {
            throw new Error(result.error || "Failed to load contributions report");
          }
          if (!cancelled) {
            setData({ kind: "contributions", ...result.data });
          }
          return;
        }

        if (reportType === "deductions") {
          const result = await getDeductionsReport(appliedFilters);
          if (!result.success) {
            throw new Error(result.error || "Failed to load deductions report");
          }
          if (!cancelled) {
            setData({ kind: "deductions", ...result.data });
          }
          return;
        }

        if (reportType === "violations") {
          const result = await getViolationsReport(appliedFilters);
          if (!result.success) {
            throw new Error(result.error || "Failed to load violations report");
          }
          if (!cancelled) {
            setData({ kind: "violations", ...result.data });
          }
          return;
        }

        const result = await getPayrollReport(appliedFilters);
        if (!result.success) {
          throw new Error(result.error || "Failed to load payroll report");
        }
        if (!cancelled) {
          setData({ kind: "payroll", ...result.data });
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : "Failed to load report.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, reportType]);

  const setFilterField = <Key extends keyof ReportFilterDraft>(
    field: Key,
    value: ReportFilterDraft[Key],
  ) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const handleApply = () => {
    setAppliedFilters(filters);
  };

  const handleReset = () => {
    setFilters(EMPTY_REPORT_FILTERS);
    setAppliedFilters(EMPTY_REPORT_FILTERS);
  };

  const handleExportPdf = () => {
    if (!data) {
      setError("No report data loaded yet.");
      return;
    }

    try {
      setExportingPdf(true);
      openReportPdf({
        reportTitle: report.title,
        reportDescription: report.description,
        filters: appliedFilters,
        data,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  const summaryCards = useMemo<SummaryCard[]>(() => {
    if (!data) return [];

    switch (data.kind) {
      case "attendance":
        return [
          { label: "Present", value: data.summary.presentCount },
          { label: "Absent", value: data.summary.absentCount },
          { label: "Late", value: data.summary.lateCount },
          { label: "Leave", value: data.summary.leaveCount },
          {
            label: "Overtime",
            value: formatHoursFromMinutes(data.summary.overtimeMinutes),
            helper: `${data.summary.overtimeMinutes} minutes approved`,
          },
          {
            label: "Net Worked",
            value: formatHoursFromMinutes(data.summary.netWorkedMinutes),
            helper: `${data.summary.totalRows} attendance row(s)`,
          },
        ];
      case "accounts":
        return [
          { label: "Total Accounts", value: data.summary.totalAccounts },
          { label: "Active", value: data.summary.activeAccounts },
          { label: "Disabled", value: data.summary.disabledAccounts },
          {
            label: "Linked Employees",
            value: data.summary.linkedEmployeeAccounts,
          },
        ];
      case "employee-information":
        return [
          { label: "Total Employees", value: data.summary.totalEmployees },
          { label: "Active Records", value: data.summary.activeEmployees },
          { label: "Archived", value: data.summary.archivedEmployees },
          {
            label: "With Department",
            value: data.summary.withDepartmentCount,
          },
          {
            label: "With Position",
            value: data.summary.withPositionCount,
          },
        ];
      case "contributions":
        return [
          {
            label: "Contribution Records",
            value: data.summary.totalContributionRecords,
          },
          {
            label: "SSS Active",
            value: data.summary.activeSssCount,
          },
          {
            label: "PhilHealth Active",
            value: data.summary.activePhilHealthCount,
          },
          {
            label: "Pag-IBIG Active",
            value: data.summary.activePagIbigCount,
          },
          {
            label: "Withholding Active",
            value: data.summary.activeWithholdingCount,
          },
        ];
      case "deductions":
        return [
          {
            label: "Assignments",
            value: data.summary.totalAssignments,
          },
          {
            label: "Employees with Active Deductions",
            value: data.summary.employeesWithActiveDeductions,
          },
          {
            label: "Open Installments",
            value: data.summary.openInstallments,
          },
          {
            label: "Completed Installments",
            value: data.summary.completedInstallmentsInRange,
            helper: "Based on the selected date range.",
          },
        ];
      case "violations":
        return [
          { label: "Total Violations", value: data.summary.totalViolations },
          { label: "Pending Review", value: data.summary.pendingReviewCount },
          { label: "Approved", value: data.summary.approvedCount },
          { label: "Rejected", value: data.summary.rejectedCount },
          {
            label: "Active Strikes",
            value: data.summary.activeStrikesTotal,
          },
        ];
      case "payroll":
        return [
          { label: "Released Runs", value: data.summary.releasedRunsCount },
          { label: "Employees Paid", value: data.summary.employeesPaidCount },
          { label: "Gross Total", value: formatMoney(data.summary.grossTotal) },
          {
            label: "Deductions Total",
            value: formatMoney(data.summary.deductionsTotal),
          },
          { label: "Net Total", value: formatMoney(data.summary.netTotal) },
        ];
      default:
        return [];
    }
  }, [data]);

  const summaryBreakdowns = useMemo<SummaryBreakdown[]>(() => {
    if (!data) return [];

    switch (data.kind) {
      case "accounts":
        return [
          {
            title: "Accounts By Role",
            items: data.summary.accountsByRole.map((entry) => ({
              label: formatRoleLabel(entry.role),
              value: entry.count,
            })),
          },
        ];
      default:
        return [];
    }
  }, [data]);

  const summaryGridClass = useMemo(() => {
    if (summaryCards.length >= 5) {
      return "xl:grid-cols-3";
    }

    if (summaryCards.length === 4) {
      return "xl:grid-cols-4";
    }

    if (summaryCards.length === 3) {
      return "xl:grid-cols-3";
    }

    return "xl:grid-cols-2";
  }, [summaryCards.length]);

  const rowCount = data?.total ?? 0;
  const isBusy = loading || loadingFilters;

  const renderTable = () => {
    if (!data) {
      return (
        <div className="rounded-xl border border-dashed px-6 py-10 text-sm text-muted-foreground">
          No report data loaded yet.
        </div>
      );
    }

    if (data.rows.length === 0) {
      return (
        <div className="rounded-xl border border-dashed px-6 py-10 text-sm text-muted-foreground">
          No rows matched the current filters.
        </div>
      );
    }

    switch (data.kind) {
      case "attendance":
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Work Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expected Shift</TableHead>
                <TableHead>Actual In</TableHead>
                <TableHead>Actual Out</TableHead>
                <TableHead>Worked</TableHead>
                <TableHead>Net Worked</TableHead>
                <TableHead>Overtime</TableHead>
                <TableHead>Posting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      {row.employeeName}
                    </div>
                    <div className="text-xs text-slate-500">{row.employeeCode}</div>
                  </TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell>{formatReportDate(row.workDate)}</TableCell>
                  <TableCell>
                    <Badge className={badgeClass("default")}>
                      {formatAttendanceStatusLabel(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.expectedShift}</TableCell>
                  <TableCell>{formatReportDateTime(row.actualInAt)}</TableCell>
                  <TableCell>{formatReportDateTime(row.actualOutAt)}</TableCell>
                  <TableCell>{formatHoursFromMinutes(row.workedMinutes)}</TableCell>
                  <TableCell>
                    {formatHoursFromMinutes(row.netWorkedMinutes)}
                  </TableCell>
                  <TableCell>{formatHoursFromMinutes(row.overtimeMinutes)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {renderBooleanBadge("Locked", row.isLocked)}
                      {renderBooleanBadge("Payroll", row.isPayrollLinked)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case "accounts":
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Linked Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.userId}>
                  <TableCell className="font-medium text-slate-900">
                    {row.username}
                  </TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>
                    <Badge className={badgeClass("default")}>
                      {formatRoleLabel(row.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.linkedEmployeeName ? (
                      <div>
                        <div className="font-medium text-slate-900">
                          {row.linkedEmployeeName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.linkedEmployeeCode}
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{row.department ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      className={badgeClass(row.isDisabled ? "danger" : "success")}
                    >
                      {row.isDisabled ? "Disabled" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatReportDateTime(row.createdAt)}</TableCell>
                  <TableCell>{formatReportDateTime(row.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case "employee-information":
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Employment Status</TableHead>
                <TableHead>Current Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Record Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.employeeId}>
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      {row.employeeName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.employeeCode}
                    </div>
                  </TableCell>
                  <TableCell>{row.department ?? "—"}</TableCell>
                  <TableCell>{row.position ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={badgeClass("default")}>
                      {formatRoleLabel(row.employmentStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={badgeClass("default")}>
                      {formatRoleLabel(row.currentStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm text-slate-700">
                      <div>{row.email ?? "—"}</div>
                      <div className="text-xs text-slate-500">
                        {row.phone ?? "No phone"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatReportDate(row.startDate)}</TableCell>
                  <TableCell>{formatReportDate(row.endDate)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        className={badgeClass(
                          row.isArchived ? "danger" : "success",
                        )}
                      >
                        {row.isArchived ? "Archived" : "Active"}
                      </Badge>
                      {row.isEnded ? (
                        <Badge className={badgeClass("warning")}>Ended</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{formatReportDateTime(row.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case "contributions":
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>SSS</TableHead>
                <TableHead>PhilHealth</TableHead>
                <TableHead>Pag-IBIG</TableHead>
                <TableHead>Withholding</TableHead>
                <TableHead>Total EE Share</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      {row.employeeName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.employeeCode}
                    </div>
                  </TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell>{formatReportDate(row.effectiveDate)}</TableCell>
                  <TableCell>{formatMoney(row.sssEe)}</TableCell>
                  <TableCell>{formatMoney(row.philHealthEe)}</TableCell>
                  <TableCell>{formatMoney(row.pagIbigEe)}</TableCell>
                  <TableCell>{formatMoney(row.withholdingEe)}</TableCell>
                  <TableCell>{formatMoney(row.employeeShareTotal)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {renderBooleanBadge("SSS", row.isSssActive)}
                      {renderBooleanBadge("PH", row.isPhilHealthActive)}
                      {renderBooleanBadge("PI", row.isPagIbigActive)}
                      {renderBooleanBadge("WH", row.isWithholdingActive)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case "deductions":
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Deduction</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Payroll Status</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      {row.employeeName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.employeeCode}
                    </div>
                  </TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell>{row.deductionTypeName}</TableCell>
                  <TableCell>
                    <Badge className={badgeClass("default")}>
                      {formatWorkflowStatusLabel(row.workflowStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={badgeClass("default")}>
                      {formatRuntimeStatusLabel(row.runtimeStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDeductionFrequencyLabel(row.frequency)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-700">
                      <div>{formatReportDate(row.effectiveFrom)}</div>
                      <div className="text-xs text-slate-500">
                        Until {formatReportDate(row.effectiveTo)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.percentValue != null
                      ? `${row.percentValue}%`
                      : row.amountValue != null
                        ? formatMoney(row.amountValue)
                        : "—"}
                    {row.installmentPerPayroll != null ? (
                      <div className="text-xs text-slate-500">
                        {formatMoney(row.installmentPerPayroll)} per payroll
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.remainingBalance != null
                      ? formatMoney(row.remainingBalance)
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-[18rem] whitespace-normal text-sm text-slate-600">
                    {row.reason ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case "violations":
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Violation</TableHead>
                <TableHead>Incident Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Strike Value</TableHead>
                <TableHead>Counted Strikes</TableHead>
                <TableHead>Acknowledged</TableHead>
                <TableHead>Reviewed By</TableHead>
                <TableHead>Reviewed At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      {row.employeeName}
                    </div>
                    <div className="text-xs text-slate-500">{row.employeeCode}</div>
                  </TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell>{row.violationType}</TableCell>
                  <TableCell>{formatReportDate(row.incidentDate)}</TableCell>
                  <TableCell>
                    <Badge className={badgeClass("default")}>
                      {formatWorkflowStatusLabel(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.strikeValue}</TableCell>
                  <TableCell>{row.countedStrikeValue}</TableCell>
                  <TableCell>
                    <Badge
                      className={badgeClass(
                        row.isAcknowledged ? "success" : "warning",
                      )}
                    >
                      {row.isAcknowledged ? "Acknowledged" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.reviewedBy ?? "—"}</TableCell>
                  <TableCell>{formatReportDateTime(row.reviewedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case "payroll":
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payroll Period</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Gross Pay</TableHead>
                <TableHead>Total Deductions</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead>Released At</TableHead>
                <TableHead>Released By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.payrollEmployeeId}>
                  <TableCell>
                    {formatReportDate(row.payrollPeriodStart)} to{" "}
                    {formatReportDate(row.payrollPeriodEnd)}
                  </TableCell>
                  <TableCell>{formatPayrollTypeLabel(row.payrollType)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      {row.employeeName}
                    </div>
                    <div className="text-xs text-slate-500">{row.employeeCode}</div>
                  </TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell>{formatMoney(row.grossPay)}</TableCell>
                  <TableCell>{formatMoney(row.totalDeductions)}</TableCell>
                  <TableCell>{formatMoney(row.netPay)}</TableCell>
                  <TableCell>{formatReportDateTime(row.releasedAt)}</TableCell>
                  <TableCell>{row.releasedBy ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{report.title}</h1>
        <p className="text-sm text-muted-foreground">{report.description}</p>
        <p className="text-sm text-muted-foreground">{report.blurb}</p>
      </div>

      <ReportsFilterBar
        reportType={reportType}
        filters={filters}
        options={options}
        searchPlaceholder={getSearchPlaceholder(reportType)}
        loading={isBusy}
        onChange={setFilterField}
        onApply={handleApply}
        onReset={handleReset}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Report Summary</p>
          <p className="text-sm text-muted-foreground">
            Key totals refresh from the currently applied filter set.
          </p>
        </div>
        {data ? (
          <div className="rounded-full border border-slate-200 bg-background px-3 py-1 text-xs text-muted-foreground">
            Updated from {rowCount} matching row{rowCount === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>

      <div className={cn("grid gap-4 md:grid-cols-2", summaryGridClass)}>
        {summaryCards.map((card) => (
          <Card key={card.label} className="gap-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-semibold">
                {card.value}
              </div>
              {card.helper ? (
                <div className="border-t pt-3 text-sm text-muted-foreground">
                  {card.helper}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {summaryBreakdowns.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-900">Breakdowns</p>
          <div className="flex flex-wrap gap-4">
            {summaryBreakdowns.map((breakdown) => (
              <div
                key={breakdown.title}
                className="w-full max-w-xl rounded-2xl border bg-background px-5 py-4 shadow-sm"
              >
                <p className="text-base font-semibold text-slate-900">
                  {breakdown.title}
                </p>
                <div className="mt-4 space-y-2">
                  {breakdown.items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-4 text-sm text-slate-700"
                    >
                      <span>{item.label}</span>
                      <span className="font-medium text-slate-900">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b">
          <div className="flex flex-row flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-lg">
                  Detailed Records
                </CardTitle>
                <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                  {rowCount} row{rowCount === 1 ? "" : "s"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Read-only results based on the currently applied filters.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleApply}
                disabled={isBusy}
              >
                Refresh
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleExportPdf}
                disabled={isBusy || exportingPdf}
              >
                {exportingPdf ? "Preparing..." : "Export PDF"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isBusy ? (
            <InlineLoadingState
              label="Loading report"
              lines={3}
              className="m-6"
            />
          ) : (
            <div className="overflow-x-auto px-1 pb-1">{renderTable()}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
