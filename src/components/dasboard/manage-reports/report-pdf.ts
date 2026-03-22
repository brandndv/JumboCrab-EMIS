import type {
  AccountsReportRow,
  AccountsReportSummary,
  AttendanceReportRow,
  AttendanceReportSummary,
  ContributionsReportRow,
  ContributionsReportSummary,
  DeductionsReportRow,
  DeductionsReportSummary,
  EmployeeInformationReportRow,
  EmployeeInformationReportSummary,
  PayrollReportRow,
  PayrollReportSummary,
  ViolationsReportRow,
  ViolationsReportSummary,
} from "@/actions/reports/reports-action";
import {
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
  type ReportFilterDraft,
} from "./report-ui-helpers";

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

export type PdfReportPayload =
  | AttendancePayload
  | AccountsPayload
  | EmployeeInformationPayload
  | ContributionsPayload
  | DeductionsPayload
  | ViolationsPayload
  | PayrollPayload;

type PrintableCard = {
  label: string;
  value: string;
  helper?: string;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderText = (value?: string | null) =>
  escapeHtml(value && value.trim().length > 0 ? value : "—");

const formatBoolean = (value: boolean) => (value ? "Yes" : "No");

const getFilterEntries = (filters: ReportFilterDraft) => {
  const entries = [
    filters.search
      ? { label: "Search", value: filters.search }
      : null,
    filters.dateFrom
      ? { label: "From", value: formatReportDate(filters.dateFrom) }
      : null,
    filters.dateTo ? { label: "To", value: formatReportDate(filters.dateTo) } : null,
    filters.departmentId
      ? { label: "Department", value: filters.departmentId }
      : null,
    filters.employeeId ? { label: "Employee", value: filters.employeeId } : null,
    filters.payrollType
      ? { label: "Payroll Type", value: formatPayrollTypeLabel(filters.payrollType) }
      : null,
    filters.attendanceStatus
      ? {
          label: "Attendance Status",
          value: formatAttendanceStatusLabel(filters.attendanceStatus),
        }
      : null,
    filters.accountRole
      ? { label: "Role", value: formatRoleLabel(filters.accountRole) }
      : null,
    filters.employmentStatus
      ? {
          label: "Employment Status",
          value: formatRoleLabel(filters.employmentStatus),
        }
      : null,
    filters.currentStatus
      ? { label: "Current Status", value: formatRoleLabel(filters.currentStatus) }
      : null,
    filters.deductionFrequency
      ? {
          label: "Deduction Frequency",
          value: formatDeductionFrequencyLabel(filters.deductionFrequency),
        }
      : null,
    filters.deductionWorkflowStatus
      ? {
          label: "Deduction Workflow",
          value: formatWorkflowStatusLabel(filters.deductionWorkflowStatus),
        }
      : null,
    filters.deductionRuntimeStatus
      ? {
          label: "Deduction Runtime",
          value: formatRuntimeStatusLabel(filters.deductionRuntimeStatus),
        }
      : null,
    filters.violationStatus
      ? {
          label: "Violation Status",
          value: formatWorkflowStatusLabel(filters.violationStatus),
        }
      : null,
    filters.payrollHasDeductions
      ? {
          label: "Has Deductions",
          value: filters.payrollHasDeductions === "yes" ? "Yes" : "No",
        }
      : null,
  ];

  return entries.filter(Boolean) as { label: string; value: string }[];
};

const getPrintableCards = (data: PdfReportPayload): PrintableCard[] => {
  switch (data.kind) {
    case "attendance":
      return [
        { label: "Present", value: String(data.summary.presentCount) },
        { label: "Absent", value: String(data.summary.absentCount) },
        { label: "Late", value: String(data.summary.lateCount) },
        { label: "Leave", value: String(data.summary.leaveCount) },
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
        { label: "Total Accounts", value: String(data.summary.totalAccounts) },
        { label: "Active", value: String(data.summary.activeAccounts) },
        { label: "Disabled", value: String(data.summary.disabledAccounts) },
        {
          label: "Linked Employees",
          value: String(data.summary.linkedEmployeeAccounts),
        },
        {
          label: "Accounts by Role",
          value:
            data.summary.accountsByRole
              .map((entry) => `${formatRoleLabel(entry.role)}: ${entry.count}`)
              .join(" | ") || "—",
        },
      ];
    case "employee-information":
      return [
        { label: "Total Employees", value: String(data.summary.totalEmployees) },
        { label: "Active Records", value: String(data.summary.activeEmployees) },
        { label: "Archived", value: String(data.summary.archivedEmployees) },
        {
          label: "With Department",
          value: String(data.summary.withDepartmentCount),
        },
        {
          label: "With Position",
          value: String(data.summary.withPositionCount),
        },
      ];
    case "contributions":
      return [
        {
          label: "Contribution Records",
          value: String(data.summary.totalContributionRecords),
        },
        { label: "SSS Active", value: String(data.summary.activeSssCount) },
        {
          label: "PhilHealth Active",
          value: String(data.summary.activePhilHealthCount),
        },
        {
          label: "Pag-IBIG Active",
          value: String(data.summary.activePagIbigCount),
        },
        {
          label: "Withholding Active",
          value: String(data.summary.activeWithholdingCount),
          helper: "Deducted-only export is available in CSV on the live page.",
        },
      ];
    case "deductions":
      return [
        { label: "Assignments", value: String(data.summary.totalAssignments) },
        {
          label: "Employees with Active Deductions",
          value: String(data.summary.employeesWithActiveDeductions),
        },
        {
          label: "Open Installments",
          value: String(data.summary.openInstallments),
        },
        {
          label: "Completed Installments",
          value: String(data.summary.completedInstallmentsInRange),
          helper: "Based on the selected date range.",
        },
      ];
    case "violations":
      return [
        { label: "Total Violations", value: String(data.summary.totalViolations) },
        {
          label: "Pending Review",
          value: String(data.summary.pendingReviewCount),
        },
        { label: "Approved", value: String(data.summary.approvedCount) },
        { label: "Rejected", value: String(data.summary.rejectedCount) },
        {
          label: "Active Strikes",
          value: String(data.summary.activeStrikesTotal),
        },
      ];
    case "payroll":
      return [
        { label: "Released Runs", value: String(data.summary.releasedRunsCount) },
        { label: "Employees Paid", value: String(data.summary.employeesPaidCount) },
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
};

const getPrintableTable = (data: PdfReportPayload) => {
  switch (data.kind) {
    case "attendance":
      return {
        headers: [
          "Employee",
          "Department",
          "Work Date",
          "Status",
          "Expected Shift",
          "Actual In",
          "Actual Out",
          "Worked",
          "Net Worked",
          "Overtime",
          "Posting",
        ],
        rows: data.rows.map((row) => [
          `${row.employeeName} (${row.employeeCode})`,
          row.department,
          formatReportDate(row.workDate),
          formatAttendanceStatusLabel(row.status),
          row.expectedShift,
          formatReportDateTime(row.actualInAt),
          formatReportDateTime(row.actualOutAt),
          formatHoursFromMinutes(row.workedMinutes),
          formatHoursFromMinutes(row.netWorkedMinutes),
          formatHoursFromMinutes(row.overtimeMinutes),
          `Locked: ${formatBoolean(row.isLocked)} | Payroll: ${formatBoolean(
            row.isPayrollLinked,
          )}`,
        ]),
      };
    case "accounts":
      return {
        headers: [
          "Username",
          "Email",
          "Role",
          "Linked Employee",
          "Department",
          "Status",
          "Created",
          "Updated",
        ],
        rows: data.rows.map((row) => [
          row.username,
          row.email,
          formatRoleLabel(row.role),
          row.linkedEmployeeName
            ? `${row.linkedEmployeeName} (${row.linkedEmployeeCode ?? "—"})`
            : "—",
          row.department ?? "—",
          row.isDisabled ? "Disabled" : "Active",
          formatReportDateTime(row.createdAt),
          formatReportDateTime(row.updatedAt),
        ]),
      };
    case "employee-information":
      return {
        headers: [
          "Employee",
          "Department",
          "Position",
          "Employment Status",
          "Current Status",
          "Email",
          "Phone",
          "Start Date",
          "End Date",
          "Record Status",
          "Updated",
        ],
        rows: data.rows.map((row) => [
          `${row.employeeName} (${row.employeeCode})`,
          row.department ?? "—",
          row.position ?? "—",
          formatRoleLabel(row.employmentStatus),
          formatRoleLabel(row.currentStatus),
          row.email ?? "—",
          row.phone ?? "—",
          formatReportDate(row.startDate),
          formatReportDate(row.endDate),
          `${row.isArchived ? "Archived" : "Active"}${
            row.isEnded ? " | Ended" : ""
          }`,
          formatReportDateTime(row.updatedAt),
        ]),
      };
    case "contributions":
      return {
        headers: [
          "Employee",
          "Department",
          "Effective Date",
          "SSS",
          "PhilHealth",
          "Pag-IBIG",
          "Withholding",
          "Total EE Share",
          "Flags",
        ],
        rows: data.rows.map((row) => [
          `${row.employeeName} (${row.employeeCode})`,
          row.department,
          formatReportDate(row.effectiveDate),
          formatMoney(row.sssEe),
          formatMoney(row.philHealthEe),
          formatMoney(row.pagIbigEe),
          formatMoney(row.withholdingEe),
          formatMoney(row.employeeShareTotal),
          `SSS: ${formatBoolean(row.isSssActive)} | PH: ${formatBoolean(
            row.isPhilHealthActive,
          )} | PI: ${formatBoolean(row.isPagIbigActive)} | WH: ${formatBoolean(
            row.isWithholdingActive,
          )}`,
        ]),
      };
    case "deductions":
      return {
        headers: [
          "Employee",
          "Department",
          "Deduction",
          "Workflow",
          "Payroll Status",
          "Frequency",
          "Schedule",
          "Value",
          "Remaining",
          "Reason",
        ],
        rows: data.rows.map((row) => [
          `${row.employeeName} (${row.employeeCode})`,
          row.department,
          row.deductionTypeName,
          formatWorkflowStatusLabel(row.workflowStatus),
          formatRuntimeStatusLabel(row.runtimeStatus),
          formatDeductionFrequencyLabel(row.frequency),
          `${formatReportDate(row.effectiveFrom)} to ${formatReportDate(
            row.effectiveTo,
          )}`,
          row.percentValue != null
            ? `${row.percentValue}%`
            : row.amountValue != null
              ? formatMoney(row.amountValue)
              : "—",
          row.remainingBalance != null ? formatMoney(row.remainingBalance) : "—",
          row.reason ?? "—",
        ]),
      };
    case "violations":
      return {
        headers: [
          "Employee",
          "Department",
          "Violation",
          "Incident Date",
          "Status",
          "Strike Value",
          "Counted Strikes",
          "Acknowledged",
          "Reviewed By",
          "Reviewed At",
        ],
        rows: data.rows.map((row) => [
          `${row.employeeName} (${row.employeeCode})`,
          row.department,
          row.violationType,
          formatReportDate(row.incidentDate),
          formatWorkflowStatusLabel(row.status),
          String(row.strikeValue),
          String(row.countedStrikeValue),
          row.isAcknowledged ? "Acknowledged" : "Pending",
          row.reviewedBy ?? "—",
          formatReportDateTime(row.reviewedAt),
        ]),
      };
    case "payroll":
      return {
        headers: [
          "Payroll Period",
          "Type",
          "Employee",
          "Department",
          "Gross Pay",
          "Total Deductions",
          "Net Pay",
          "Released At",
          "Released By",
        ],
        rows: data.rows.map((row) => [
          `${formatReportDate(row.payrollPeriodStart)} to ${formatReportDate(
            row.payrollPeriodEnd,
          )}`,
          formatPayrollTypeLabel(row.payrollType),
          `${row.employeeName} (${row.employeeCode})`,
          row.department,
          formatMoney(row.grossPay),
          formatMoney(row.totalDeductions),
          formatMoney(row.netPay),
          formatReportDateTime(row.releasedAt),
          row.releasedBy ?? "—",
        ]),
      };
    default:
      return { headers: [], rows: [] };
  }
};

export function openReportPdf(params: {
  reportTitle: string;
  reportDescription: string;
  filters: ReportFilterDraft;
  data: PdfReportPayload;
}) {
  const generatedAt = new Date().toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const filters = getFilterEntries(params.filters);
  const summaryCards = getPrintableCards(params.data);
  const table = getPrintableTable(params.data);

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(params.reportTitle)} Report</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        color: #0f172a;
        background: #ffffff;
      }
      .sheet { width: 100%; }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        align-items: flex-start;
        margin-bottom: 20px;
      }
      .title {
        margin: 0 0 8px;
        font-size: 28px;
        font-weight: 700;
      }
      .description {
        margin: 0;
        font-size: 13px;
        line-height: 1.6;
        color: #475569;
      }
      .meta {
        min-width: 240px;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        padding: 12px 14px;
        font-size: 12px;
        line-height: 1.6;
      }
      .filters,
      .summary,
      .table-wrap {
        border: 1px solid #cbd5e1;
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 18px;
      }
      .section-title {
        margin: 0 0 10px;
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #64748b;
        font-weight: 700;
      }
      .filters-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .filter-chip {
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .summary-card {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px;
        min-height: 88px;
      }
      .summary-label {
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #64748b;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .summary-value {
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 6px;
      }
      .summary-helper {
        font-size: 11px;
        color: #64748b;
        line-height: 1.5;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: auto;
      }
      th, td {
        border: 1px solid #e2e8f0;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
        font-size: 11px;
        line-height: 1.5;
      }
      th {
        background: #f8fafc;
        font-weight: 700;
        color: #0f172a;
      }
      .count {
        margin: 0 0 12px;
        font-size: 12px;
        color: #475569;
      }
      @media print {
        .sheet { width: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div>
          <h1 class="title">${escapeHtml(params.reportTitle)}</h1>
          <p class="description">${escapeHtml(params.reportDescription)}</p>
        </div>
        <div class="meta">
          <div><strong>Generated:</strong> ${escapeHtml(generatedAt)}</div>
          <div><strong>Rows:</strong> ${params.data.total}</div>
        </div>
      </div>
      <section class="filters">
        <h2 class="section-title">Applied Filters</h2>
        ${
          filters.length > 0
            ? `<div class="filters-list">${filters
                .map(
                  (entry) =>
                    `<div class="filter-chip"><strong>${escapeHtml(
                      entry.label,
                    )}:</strong> ${escapeHtml(entry.value)}</div>`,
                )
                .join("")}</div>`
            : `<div class="description">No additional filters applied.</div>`
        }
      </section>
      <section class="summary">
        <h2 class="section-title">Summary</h2>
        <div class="summary-grid">
          ${summaryCards
            .map(
              (card) => `
                <div class="summary-card">
                  <div class="summary-label">${escapeHtml(card.label)}</div>
                  <div class="summary-value">${escapeHtml(card.value)}</div>
                  ${
                    card.helper
                      ? `<div class="summary-helper">${escapeHtml(card.helper)}</div>`
                      : ""
                  }
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
      <section class="table-wrap">
        <h2 class="section-title">Detail Table</h2>
        <p class="count">${params.data.total} row${params.data.total === 1 ? "" : "s"} in this report.</p>
        <table>
          <thead>
            <tr>${table.headers
              .map((header) => `<th>${escapeHtml(header)}</th>`)
              .join("")}</tr>
          </thead>
          <tbody>
            ${table.rows
              .map(
                (row) =>
                  `<tr>${row
                    .map((cell) => `<td>${renderText(cell)}</td>`)
                    .join("")}</tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </section>
    </div>
    <script>
      window.addEventListener("load", () => {
        setTimeout(() => window.print(), 250);
      });
    </script>
  </body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank");

  if (!popup) {
    URL.revokeObjectURL(url);
    throw new Error("Unable to open print preview. Please allow pop-ups.");
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
