"use client";

import { useState, type ReactNode } from "react";
import type { ReportFilterOptions } from "@/actions/reports/reports-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REPORT_ATTENDANCE_STATUS_OPTIONS,
  REPORT_CURRENT_STATUS_OPTIONS,
  REPORT_DEDUCTION_FREQUENCY_OPTIONS,
  REPORT_DEDUCTION_RUNTIME_OPTIONS,
  REPORT_DEDUCTION_WORKFLOW_OPTIONS,
  REPORT_EMPLOYMENT_STATUS_OPTIONS,
  REPORT_HAS_DEDUCTIONS_OPTIONS,
  REPORT_PAYROLL_TYPE_OPTIONS,
  REPORT_ROLE_OPTIONS,
  REPORT_VIOLATION_STATUS_OPTIONS,
  type ReportFilterDraft,
  type ReportType,
} from "./report-ui-helpers";

type ReportsFilterBarProps = {
  reportType: ReportType;
  filters: ReportFilterDraft;
  options: ReportFilterOptions | null;
  searchPlaceholder: string;
  loading?: boolean;
  onChange: <Key extends keyof ReportFilterDraft>(
    field: Key,
    value: ReportFilterDraft[Key],
  ) => void;
  onApply: () => void;
  onReset: () => void;
};

const ALL_VALUE = "__all__";

export default function ReportsFilterBar({
  reportType,
  filters,
  options,
  searchPlaceholder,
  loading = false,
  onChange,
  onApply,
  onReset,
}: ReportsFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const renderSelectField = (
    label: string,
    field: keyof ReportFilterDraft,
    placeholder: string,
    options: readonly { value: string; label: string }[],
  ) => (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">
        {label}
      </p>
      <Select
        value={(filters[field] as string) || ALL_VALUE}
        onValueChange={(value) =>
          onChange(field, (value === ALL_VALUE ? "" : value) as ReportFilterDraft[typeof field])
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const advancedFields: ReactNode[] = [];
  const advancedFieldKeys: (keyof ReportFilterDraft)[] = [];

  if (reportType === "attendance") {
    advancedFieldKeys.push("attendanceStatus");
    advancedFields.push(
      renderSelectField(
        "Attendance Status",
        "attendanceStatus",
        "All attendance statuses",
        REPORT_ATTENDANCE_STATUS_OPTIONS,
      ),
    );
  }

  if (reportType === "accounts") {
    advancedFieldKeys.push("accountRole");
    advancedFields.push(
      renderSelectField("Role", "accountRole", "All roles", REPORT_ROLE_OPTIONS),
    );
  }

  if (reportType === "employee-information") {
    advancedFieldKeys.push("employmentStatus");
    advancedFields.push(
      renderSelectField(
        "Employment Status",
        "employmentStatus",
        "All employment statuses",
        REPORT_EMPLOYMENT_STATUS_OPTIONS,
      ),
    );
    advancedFieldKeys.push("currentStatus");
    advancedFields.push(
      renderSelectField(
        "Current Status",
        "currentStatus",
        "All current statuses",
        REPORT_CURRENT_STATUS_OPTIONS,
      ),
    );
  }

  if (reportType === "deductions") {
    advancedFieldKeys.push("deductionFrequency");
    advancedFields.push(
      renderSelectField(
        "Frequency",
        "deductionFrequency",
        "All frequencies",
        REPORT_DEDUCTION_FREQUENCY_OPTIONS,
      ),
    );
    advancedFieldKeys.push("deductionWorkflowStatus");
    advancedFields.push(
      renderSelectField(
        "Workflow",
        "deductionWorkflowStatus",
        "All workflow statuses",
        REPORT_DEDUCTION_WORKFLOW_OPTIONS,
      ),
    );
    advancedFieldKeys.push("deductionRuntimeStatus");
    advancedFields.push(
      renderSelectField(
        "Runtime Status",
        "deductionRuntimeStatus",
        "All runtime statuses",
        REPORT_DEDUCTION_RUNTIME_OPTIONS,
      ),
    );
  }

  if (reportType === "violations") {
    advancedFieldKeys.push("violationStatus");
    advancedFields.push(
      renderSelectField(
        "Violation Status",
        "violationStatus",
        "All violation statuses",
        REPORT_VIOLATION_STATUS_OPTIONS,
      ),
    );
  }

  if (reportType === "payroll") {
    advancedFieldKeys.push("payrollType");
    advancedFields.push(
      renderSelectField(
        "Payroll Type",
        "payrollType",
        "All payroll types",
        REPORT_PAYROLL_TYPE_OPTIONS,
      ),
    );
    advancedFieldKeys.push("payrollHasDeductions");
    advancedFields.push(
      renderSelectField(
        "Has Deductions",
        "payrollHasDeductions",
        "All payroll rows",
        REPORT_HAS_DEDUCTIONS_OPTIONS,
      ),
    );
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const activeAdvancedFilterCount = advancedFieldKeys.filter((key) =>
    Boolean(filters[key]),
  ).length;

  return (
    <Card className="gap-0 shadow-sm">
      <CardHeader className="border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">Filter Workspace</CardTitle>
            <p className="text-sm text-muted-foreground">
              Narrow the report by date, department, employee, and the filters
              specific to this report.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-slate-200 bg-background px-3 py-1 text-xs text-muted-foreground">
              {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
            </div>
            {advancedFields.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowAdvanced((current) => !current)}
                disabled={loading}
              >
                {showAdvanced ? "Hide Filters" : "More Filters"}
                {activeAdvancedFilterCount > 0
                  ? ` (${activeAdvancedFilterCount})`
                  : ""}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onReset}
              disabled={loading}
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onApply}
              className="min-w-28"
              disabled={loading}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,1fr))]">
          <div className="space-y-2 xl:col-span-1">
            <p className="text-sm font-medium text-muted-foreground">
              Search
            </p>
            <Input
              value={filters.search}
              onChange={(event) => onChange("search", event.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              From
            </p>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => onChange("dateFrom", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              To
            </p>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(event) => onChange("dateTo", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Department
            </p>
            <Select
              value={filters.departmentId || ALL_VALUE}
              onValueChange={(value) =>
                onChange("departmentId", value === ALL_VALUE ? "" : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All departments</SelectItem>
                {(options?.departments ?? []).map((department) => (
                  <SelectItem
                    key={department.departmentId}
                    value={department.departmentId}
                  >
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Employee
            </p>
            <Select
              value={filters.employeeId || ALL_VALUE}
              onValueChange={(value) =>
                onChange("employeeId", value === ALL_VALUE ? "" : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All employees</SelectItem>
                {(options?.employees ?? []).map((employee) => (
                  <SelectItem key={employee.employeeId} value={employee.employeeId}>
                    {employee.employeeCode} · {employee.employeeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {advancedFields.length > 0 ? (
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleContent>
              <div className="grid gap-4 border-t pt-4 md:grid-cols-2 xl:grid-cols-3">
                {advancedFields.map((field, index) => (
                  <div key={index}>{field}</div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </CardContent>
    </Card>
  );
}
