"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getPayrollPayslip,
  listPayrollPayslips,
} from "@/actions/payroll/payroll-action";
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
import { useSession } from "@/hooks/use-session";
import { TZ } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type {
  PayrollDeductionLine,
  PayrollEarningLine,
  PayrollPayslipDetail,
  PayrollPayslipSummary,
  PayrollStatusValue,
} from "@/types/payroll";
import {
  formatCurrency,
  formatDateTime,
  formatDateRange,
  formatMinutes,
  humanizePayrollType,
  payrollTypeClass,
  statusClass,
} from "./payroll-ui-helpers";

const humanizeIdentifier = (value: string) => {
  if (!value.includes("_")) return value;
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const plainEnglishPayrollType = (
  value: PayrollPayslipSummary["payrollType"],
) => {
  if (value === "BIMONTHLY") return "Bi-monthly payroll";
  if (value === "MONTHLY") return "Monthly payroll";
  if (value === "WEEKLY") return "Weekly payroll";
  return "Special payroll run";
};

const plainEnglishLineLabel = (
  line: PayrollEarningLine | PayrollDeductionLine,
) => {
  if ("earningType" in line) {
    if (line.earningType === "BASE_PAY") return "Regular pay";
    if (line.earningType === "OVERTIME_PAY") return "Overtime pay";
    if (line.earningType === "ADJUSTMENT") return "Pay adjustment";
    if (line.earningType === "BONUS") return "Bonus";
    if (line.earningType === "ALLOWANCE") return "Allowance";
    return humanizeIdentifier(line.earningType);
  }

  if (line.deductionNameSnapshot?.trim()) return line.deductionNameSnapshot;

  if (line.deductionType === "UNDERTIME_DEDUCTION")
    return "Undertime deduction";
  if (line.deductionType === "CONTRIBUTION_SSS") return "SSS contribution";
  if (line.deductionType === "CONTRIBUTION_PHILHEALTH") {
    return "PhilHealth contribution";
  }
  if (line.deductionType === "CONTRIBUTION_PAGIBIG") {
    return "Pag-IBIG contribution";
  }
  if (line.deductionType === "WITHHOLDING_TAX") return "Withholding tax";
  if (line.deductionType === "LOAN") return "Loan payment";
  if (line.deductionType === "CASH_ADVANCE") return "Cash advance";
  if (line.deductionType === "PENALTY") return "Penalty";
  if (line.deductionType === "OTHER") return "Other deduction";

  if (line.deductionCodeSnapshot?.trim()) {
    return humanizeIdentifier(line.deductionCodeSnapshot);
  }

  return humanizeIdentifier(line.deductionType);
};

const lineTitle = (line: PayrollEarningLine | PayrollDeductionLine) =>
  plainEnglishLineLabel(line);

const earningLineMeta = (line: PayrollEarningLine) => {
  const bits: string[] = [];
  if (line.minutes != null) {
    bits.push(formatMinutes(line.minutes));
  }
  if (line.remarks) {
    bits.push(line.remarks);
  }
  return bits.join(" · ") || "System earning line";
};

const deductionLineMeta = (line: PayrollDeductionLine) => {
  const bits: string[] = [];
  if (line.remarks) {
    bits.push(line.remarks);
  }
  if (line.minutes != null) {
    bits.push(formatMinutes(line.minutes));
  }
  return bits.join(" · ") || "System deduction line";
};

const payslipActivityLabel = (row: {
  releasedAt: string | null;
  generatedAt: string;
}) =>
  row.releasedAt
    ? `Released ${formatDateTime(row.releasedAt)}`
    : `Generated ${formatDateTime(row.generatedAt)}`;

const ReceiptRow = ({
  label,
  amount,
  tone = "default",
  strong = false,
}: {
  label: string;
  amount: number;
  tone?: "default" | "positive" | "negative";
  strong?: boolean;
}) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <span
      className={cn(
        "text-muted-foreground",
        strong && "font-medium text-foreground",
      )}
    >
      {label}
    </span>
    <span
      className={cn(
        "font-mono tabular-nums",
        strong && "font-semibold text-foreground",
        tone === "positive" && "text-emerald-700 dark:text-emerald-400",
        tone === "negative" && "text-destructive",
      )}
    >
      {formatCurrency(amount)}
    </span>
  </div>
);

const PayslipReceipt = ({ payslip }: { payslip: PayrollPayslipDetail }) => (
  <section className="rounded-2xl border border-border/70 bg-gradient-to-b from-background to-muted/10 shadow-sm">
    <div className="border-b border-dashed px-5 py-5 sm:px-6">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
        Receipt Breakdown
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Payslip Receipt</h3>
          <p className="text-sm text-muted-foreground">
            {plainEnglishPayrollType(payslip.payrollType)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDateRange(
            payslip.payrollPeriodStart,
            payslip.payrollPeriodEnd,
          )}
        </p>
      </div>
    </div>

    <div className="space-y-6 px-5 py-5 sm:px-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Earnings
        </p>
        {payslip.earnings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No earnings recorded.</p>
        ) : (
          payslip.earnings.map((line) => (
            <ReceiptRow
              key={line.id}
              label={lineTitle(line)}
              amount={line.amount}
              tone="positive"
            />
          ))
        )}
        <div className="border-t border-dashed pt-4">
          <ReceiptRow
            label="Total earnings"
            amount={payslip.totalEarnings}
            tone="positive"
            strong
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-dashed pt-5">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Deductions
        </p>
        {payslip.deductions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No deductions recorded.
          </p>
        ) : (
          payslip.deductions.map((line) => (
            <ReceiptRow
              key={line.id}
              label={lineTitle(line)}
              amount={line.amount}
              tone="negative"
            />
          ))
        )}
        <div className="border-t border-dashed pt-4">
          <ReceiptRow
            label="Total deductions"
            amount={payslip.totalDeductions}
            tone="negative"
            strong
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-dashed pt-5">
        <ReceiptRow label="Gross pay" amount={payslip.grossPay} />
        <ReceiptRow
          label="Less deductions"
          amount={payslip.totalDeductions}
          tone="negative"
        />
        <div className="border-t border-dashed pt-4">
          <ReceiptRow
            label="Net pay"
            amount={payslip.netPay}
            tone="positive"
            strong
          />
        </div>
      </div>
    </div>
  </section>
);

const historyMonthLabel = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: TZ,
    month: "long",
    year: "numeric",
  }).format(new Date(value));

const EmployeePayslipDetail = ({
  payslip,
}: {
  payslip: PayrollPayslipDetail;
}) => (
  <div className="space-y-8 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 p-6 shadow-sm sm:p-7">
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge
          variant="outline"
          className={payrollTypeClass(payslip.payrollType)}
        >
          {plainEnglishPayrollType(payslip.payrollType)}
        </Badge>
        <Badge variant="outline" className={statusClass(payslip.payrollStatus)}>
          {payslip.payrollStatus}
        </Badge>
      </div>
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Payroll Period
        </p>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {formatDateRange(
            payslip.payrollPeriodStart,
            payslip.payrollPeriodEnd,
          )}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {payslipActivityLabel(payslip)}. This payslip reflects the completed
          payroll run for the period above.
        </p>
      </div>
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <PayslipReceipt payslip={payslip} />

      <aside className="space-y-4">
        <section className="rounded-xl border border-border/70 bg-background/85 p-5">
          <h3 className="text-base font-semibold">Work Summary</h3>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Attendance
              </p>
              <p className="mt-1">
                Present {payslip.daysPresent} · Absent {payslip.daysAbsent} ·
                Late {payslip.daysLate}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Time
              </p>
              <p className="mt-1">
                OT {formatMinutes(payslip.minutesOvertime)} · UT{" "}
                {formatMinutes(payslip.minutesUndertime)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Gross Pay
              </p>
              <p className="mt-1">{formatCurrency(payslip.grossPay)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Net Worked
              </p>
              <p className="mt-1">{formatMinutes(payslip.minutesNetWorked)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border/70 bg-background/85 p-5">
          <h3 className="text-base font-semibold">Rate Snapshot</h3>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Daily Rate
              </p>
              <p className="mt-1">
                {payslip.dailyRateSnapshot != null
                  ? formatCurrency(payslip.dailyRateSnapshot)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Rate / Minute
              </p>
              <p className="mt-1">
                {payslip.ratePerMinuteSnapshot != null
                  ? formatCurrency(payslip.ratePerMinuteSnapshot)
                  : "—"}
              </p>
            </div>
          </div>
          {payslip.notes ? (
            <div className="mt-4 border-t pt-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Notes
              </p>
              <p className="mt-1 text-sm">{payslip.notes}</p>
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  </div>
);

type StatusFilter = "ALL" | PayrollStatusValue;

type PayrollPayslipsPageProps = {
  viewMode?: "default" | "history";
};

const PayrollPayslipsPage = ({
  viewMode = "default",
}: PayrollPayslipsPageProps = {}) => {
  const { user, loading: sessionLoading } = useSession();
  const isEmployeeView = user?.role === "employee";
  const isEmployeeHistoryView = isEmployeeView && viewMode === "history";
  const [rows, setRows] = useState<PayrollPayslipSummary[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(
    null,
  );
  const [selectedPayslip, setSelectedPayslip] =
    useState<PayrollPayslipDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadRows = async () => {
    try {
      setLoadingRows(true);
      setRowsError(null);
      const result = await listPayrollPayslips();
      if (!result.success) {
        throw new Error(result.error || "Failed to load payslips");
      }
      const data = (result.data ?? []).sort((a, b) => {
        const periodDelta =
          new Date(b.payrollPeriodStart).getTime() -
          new Date(a.payrollPeriodStart).getTime();
        if (periodDelta !== 0) {
          return periodDelta;
        }
        return (
          new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
        );
      });
      setRows(data);
      if (!isEmployeeHistoryView && data.length > 0 && !selectedPayslipId) {
        setSelectedPayslipId(data[0].payrollEmployeeId);
      }
    } catch (err) {
      setRows([]);
      setRowsError(
        err instanceof Error ? err.message : "Failed to load payslips",
      );
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      void loadRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedPayslipId) {
        setSelectedPayslip(null);
        return;
      }
      try {
        setLoadingDetail(true);
        setDetailError(null);
        const result = await getPayrollPayslip(selectedPayslipId);
        if (!result.success) {
          throw new Error(result.error || "Failed to load payslip detail");
        }
        setSelectedPayslip(result.data ?? null);
      } catch (err) {
        setSelectedPayslip(null);
        setDetailError(
          err instanceof Error ? err.message : "Failed to load payslip detail",
        );
      } finally {
        setLoadingDetail(false);
      }
    };
    void loadDetail();
  }, [selectedPayslipId]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.payrollStatus !== statusFilter) {
        return false;
      }
      if (isEmployeeView || !search.trim()) return true;
      const query = search.trim().toLowerCase();
      return (
        row.employeeName.toLowerCase().includes(query) ||
        row.employeeCode.toLowerCase().includes(query) ||
        row.payrollId.toLowerCase().includes(query)
      );
    });
  }, [isEmployeeView, rows, search, statusFilter]);

  const totalNet = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.netPay, 0),
    [filteredRows],
  );
  const totalEarnings = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.totalEarnings, 0),
    [filteredRows],
  );
  const releasedCount = useMemo(
    () => filteredRows.filter((row) => row.payrollStatus === "RELEASED").length,
    [filteredRows],
  );
  const latestPayslip = useMemo(() => filteredRows[0] ?? null, [filteredRows]);
  const recentEmployeeRows = useMemo(
    () =>
      isEmployeeView && !isEmployeeHistoryView
        ? filteredRows.slice(0, 6)
        : filteredRows,
    [filteredRows, isEmployeeHistoryView, isEmployeeView],
  );
  const employeeHistoryGroups = useMemo(() => {
    if (!isEmployeeHistoryView) return [];

    const groups = new Map<string, PayrollPayslipSummary[]>();

    filteredRows.forEach((row) => {
      const label = historyMonthLabel(row.payrollPeriodStart);
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)!.push(row);
    });

    return Array.from(groups.entries()).map(([label, items]) => ({
      label,
      items,
      count: items.length,
      netTotal: items.reduce((sum, item) => sum + item.netPay, 0),
    }));
  }, [filteredRows, isEmployeeHistoryView]);

  useEffect(() => {
    if (filteredRows.length === 0) {
      setSelectedPayslipId(null);
      return;
    }

    if (
      isEmployeeHistoryView &&
      selectedPayslipId &&
      !filteredRows.some((row) => row.payrollEmployeeId === selectedPayslipId)
    ) {
      setSelectedPayslipId(null);
      return;
    }

    if (
      !isEmployeeHistoryView &&
      (!selectedPayslipId ||
        !filteredRows.some(
          (row) => row.payrollEmployeeId === selectedPayslipId,
        ))
    ) {
      setSelectedPayslipId(filteredRows[0].payrollEmployeeId);
    }
  }, [filteredRows, isEmployeeHistoryView, selectedPayslipId]);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div>
        <h1 className="text-2xl font-semibold">
          {isEmployeeView
            ? isEmployeeHistoryView
              ? "Payslip History"
              : "My Payslips"
            : "Payslips"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEmployeeView
            ? isEmployeeHistoryView
              ? "Browse your released payslip archive and open any period for the full breakdown."
              : "Released payroll periods for your account, with a clean breakdown per payslip."
            : "View payroll payouts with itemized earning and deduction lines."}
        </p>
      </div>

      {isEmployeeView ? (
        <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                {isEmployeeHistoryView
                  ? "Payslip Archive"
                  : "Personal Payroll Ledger"}
              </p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {isEmployeeHistoryView
                  ? "Every released payslip in one employee archive."
                  : "Clean, released payslips for every payroll run."}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {isEmployeeHistoryView
                  ? "Move through earlier payroll periods, review the receipt breakdown for each release, and keep a readable record of every payout."
                  : "Review each completed payroll period, open the receipt-style breakdown, and keep a clear record of what was earned and deducted."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Latest
                </p>
                <p className="mt-2 text-base font-semibold tracking-tight">
                  {latestPayslip
                    ? formatDateRange(
                        latestPayslip.payrollPeriodStart,
                        latestPayslip.payrollPeriodEnd,
                      )
                    : "No payslips yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {latestPayslip ? formatCurrency(latestPayslip.netPay) : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Payslips
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  {filteredRows.length}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Total Received
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  {formatCurrency(totalNet)}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Payslips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{filteredRows.length}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Released
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{releasedCount}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Earnings Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatCurrency(totalEarnings)}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatCurrency(totalNet)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card
        className={cn(
          "shadow-sm",
          isEmployeeView && "rounded-2xl border-border/70",
        )}
      >
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">
                {isEmployeeView
                  ? isEmployeeHistoryView
                    ? "Payslip Archive"
                    : "Available Periods"
                  : "Payslip Records"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {isEmployeeView
                  ? isEmployeeHistoryView
                    ? "Released periods for the logged-in employee, grouped by month."
                    : "Your latest payslip stays open below. Open History for the full archive."
                  : "Shared responsive layout for employee and admin-side payslip views."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isEmployeeView ? (
                <Button asChild type="button" variant="outline">
                  <Link
                    href={
                      isEmployeeHistoryView
                        ? "/employee/payslip"
                        : "/employee/payslip/history"
                    }
                  >
                    {isEmployeeHistoryView
                      ? "Open latest payslip"
                      : "Open history"}
                  </Link>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadRows()}
              >
                Refresh
              </Button>
            </div>
          </div>
          {!isEmployeeView ? (
            <div className="grid gap-2 lg:grid-cols-[1.2fr_minmax(0,180px)]">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employee, code, or payroll id"
              />
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="ALL">All statuses</option>
                <option value="RELEASED">Released</option>
                <option value="REVIEWED">Reviewed</option>
                <option value="DRAFT">Draft</option>
                <option value="FINALIZED">Finalized</option>
                <option value="VOIDED">Voided</option>
              </select>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingRows ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Loading payslips...
            </div>
          ) : null}
          {!loadingRows && rowsError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {rowsError}
            </div>
          ) : null}
          {!loadingRows && !rowsError && filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No payslips found.
            </div>
          ) : null}
          {!loadingRows && !rowsError && isEmployeeHistoryView ? (
            <div className="space-y-4">
              {employeeHistoryGroups.map((group) => (
                <section
                  key={group.label}
                  className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold">{group.label}</h3>
                      <p className="text-sm text-muted-foreground">
                        {group.count} payslips · Net{" "}
                        {formatCurrency(group.netTotal)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((row) => {
                      const selected =
                        selectedPayslipId === row.payrollEmployeeId;

                      return (
                        <div
                          key={row.payrollEmployeeId}
                          className={cn(
                            "w-full rounded-xl border bg-background px-4 py-3 transition-colors",
                            selected && "border-primary bg-primary/5 shadow-sm",
                          )}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <Badge
                                  variant="outline"
                                  className={payrollTypeClass(row.payrollType)}
                                >
                                  {plainEnglishPayrollType(row.payrollType)}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={statusClass(row.payrollStatus)}
                                >
                                  {row.payrollStatus}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <p className="text-base font-semibold tracking-tight">
                                  {formatDateRange(
                                    row.payrollPeriodStart,
                                    row.payrollPeriodEnd,
                                  )}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {payslipActivityLabel(row)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 sm:justify-end">
                              <div className="text-left sm:text-right">
                                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                                  Net pay
                                </p>
                                <p className="mt-1 text-lg font-semibold tracking-tight">
                                  {formatCurrency(row.netPay)}
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant={selected ? "default" : "outline"}
                                onClick={() =>
                                  setSelectedPayslipId(row.payrollEmployeeId)
                                }
                              >
                                {selected ? "Viewing" : "View"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : !loadingRows && !rowsError ? (
            recentEmployeeRows.map((row) => {
              const selected = selectedPayslipId === row.payrollEmployeeId;

              return (
                <button
                  key={row.payrollEmployeeId}
                  type="button"
                  onClick={() => setSelectedPayslipId(row.payrollEmployeeId)}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-colors",
                    "hover:border-primary/40 hover:bg-primary/5",
                    selected && "border-primary bg-primary/5 shadow-sm",
                  )}
                >
                  {isEmployeeView ? (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="outline"
                            className={payrollTypeClass(row.payrollType)}
                          >
                            {plainEnglishPayrollType(row.payrollType)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={statusClass(row.payrollStatus)}
                          >
                            {row.payrollStatus}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xl font-semibold tracking-tight">
                            {formatDateRange(
                              row.payrollPeriodStart,
                              row.payrollPeriodEnd,
                            )}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {payslipActivityLabel(row)}
                          </p>
                        </div>
                      </div>

                      <div className="sm:min-w-[220px] sm:text-right">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                          Net pay
                        </p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight">
                          {formatCurrency(row.netPay)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Gross {formatCurrency(row.grossPay)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(220px,0.75fr)] xl:items-start">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold leading-tight">
                            {row.employeeName}
                          </p>
                          <span className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {row.employeeCode}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDateRange(
                            row.payrollPeriodStart,
                            row.payrollPeriodEnd,
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payslipActivityLabel(row)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="outline"
                            className={payrollTypeClass(row.payrollType)}
                          >
                            {humanizePayrollType(row.payrollType)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={statusClass(row.payrollStatus)}
                          >
                            {row.payrollStatus}
                          </Badge>
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                          <span>
                            Earnings {formatCurrency(row.totalEarnings)}
                          </span>
                          <span>
                            Deductions {formatCurrency(row.totalDeductions)}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Net pay
                        </p>
                        <p className="mt-1 text-2xl font-semibold">
                          {formatCurrency(row.netPay)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Gross {formatCurrency(row.grossPay)}
                        </p>
                      </div>
                    </div>
                  )}
                </button>
              );
            })
          ) : null}
          {!loadingRows &&
          !rowsError &&
          isEmployeeView &&
          !isEmployeeHistoryView &&
          filteredRows.length > recentEmployeeRows.length ? (
            <div className="flex justify-end">
              <Button asChild type="button" variant="ghost" size="sm">
                <Link href="/employee/payslip/history">View full archive</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!isEmployeeHistoryView ? (
        <Card
          className={cn(
            "overflow-hidden shadow-sm",
            isEmployeeView &&
              "rounded-2xl border-none bg-transparent shadow-none",
          )}
        >
          {!isEmployeeView ? (
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="text-lg">Payslip Details</CardTitle>
            </CardHeader>
          ) : null}
          <CardContent
            className={cn("space-y-6", isEmployeeView ? "p-0" : "p-6")}
          >
            {loadingDetail ? (
              <p className="text-sm text-muted-foreground">
                Loading payslip details...
              </p>
            ) : null}
            {!loadingDetail && detailError ? (
              <p className="text-sm text-destructive">{detailError}</p>
            ) : null}
            {!loadingDetail && !detailError && !selectedPayslip ? (
              <p className="text-sm text-muted-foreground">
                {isEmployeeHistoryView
                  ? "Choose View on a payslip row to open its full breakdown."
                  : "Select a payslip record to inspect details."}
              </p>
            ) : null}

            {!loadingDetail && !detailError && selectedPayslip ? (
              user?.role === "employee" ? (
                <EmployeePayslipDetail payslip={selectedPayslip} />
              ) : (
                <>
                  <div className="rounded-2xl border bg-gradient-to-br from-muted/40 to-background p-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant="outline"
                            className={payrollTypeClass(
                              selectedPayslip.payrollType,
                            )}
                          >
                            {humanizePayrollType(selectedPayslip.payrollType)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={statusClass(
                              selectedPayslip.payrollStatus,
                            )}
                          >
                            {selectedPayslip.payrollStatus}
                          </Badge>
                        </div>
                        <div>
                          <h2 className="text-2xl font-semibold tracking-tight">
                            {selectedPayslip.employeeName}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {selectedPayslip.employeeCode}
                          </p>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>
                            Payroll period{" "}
                            {formatDateRange(
                              selectedPayslip.payrollPeriodStart,
                              selectedPayslip.payrollPeriodEnd,
                            )}
                          </p>
                          <p>
                            Attendance window{" "}
                            {formatDateRange(
                              selectedPayslip.attendanceStart,
                              selectedPayslip.attendanceEnd,
                            )}
                          </p>
                          <p>{payslipActivityLabel(selectedPayslip)}</p>
                        </div>
                      </div>

                      <div className="min-w-[220px] rounded-xl border bg-background/80 p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Net pay
                        </p>
                        <p className="mt-1 text-3xl font-semibold">
                          {formatCurrency(selectedPayslip.netPay)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedPayslip.daysPresent} present ·{" "}
                          {selectedPayslip.daysAbsent} absent
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border bg-muted/10 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Gross Pay
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {formatCurrency(selectedPayslip.grossPay)}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-muted/10 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Total Earnings
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {formatCurrency(selectedPayslip.totalEarnings)}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-muted/10 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Total Deductions
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {formatCurrency(selectedPayslip.totalDeductions)}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-muted/10 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Net Worked
                      </p>
                      <p className="mt-2 text-xl font-semibold">
                        {formatMinutes(selectedPayslip.minutesNetWorked)}
                      </p>
                    </div>
                  </div>

                  <PayslipReceipt payslip={selectedPayslip} />

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                    <div className="rounded-xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold">Earnings</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedPayslip.earnings.length} line items
                          </p>
                        </div>
                        <p className="text-base font-semibold">
                          {formatCurrency(selectedPayslip.totalEarnings)}
                        </p>
                      </div>
                      <div className="mt-4 space-y-3">
                        {selectedPayslip.earnings.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No earnings lines.
                          </p>
                        ) : (
                          selectedPayslip.earnings.map((line) => (
                            <div
                              key={line.id}
                              className="rounded-xl border bg-muted/10 p-3"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="font-medium">
                                    {lineTitle(line)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {earningLineMeta(line)}
                                  </p>
                                </div>
                                <p className="text-base font-semibold">
                                  {formatCurrency(line.amount)}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold">
                              Deductions
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {selectedPayslip.deductions.length} line items
                            </p>
                          </div>
                          <p className="text-base font-semibold">
                            {formatCurrency(selectedPayslip.totalDeductions)}
                          </p>
                        </div>
                        <div className="mt-4 space-y-3">
                          {selectedPayslip.deductions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No deduction lines.
                            </p>
                          ) : (
                            selectedPayslip.deductions.map((line) => (
                              <div
                                key={line.id}
                                className="rounded-xl border bg-muted/10 p-3"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="font-medium">
                                      {lineTitle(line)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {deductionLineMeta(line)}
                                    </p>
                                  </div>
                                  <p className="text-base font-semibold">
                                    {formatCurrency(line.amount)}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border bg-muted/15 p-4">
                        <h3 className="text-base font-semibold">
                          Work Snapshot
                        </h3>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Attendance
                            </p>
                            <p className="mt-1 text-sm">
                              Present {selectedPayslip.daysPresent} · Absent{" "}
                              {selectedPayslip.daysAbsent} · Late{" "}
                              {selectedPayslip.daysLate}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Time
                            </p>
                            <p className="mt-1 text-sm">
                              OT{" "}
                              {formatMinutes(selectedPayslip.minutesOvertime)} ·
                              UT{" "}
                              {formatMinutes(selectedPayslip.minutesUndertime)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Daily Rate
                            </p>
                            <p className="mt-1 text-sm">
                              {selectedPayslip.dailyRateSnapshot != null
                                ? formatCurrency(
                                    selectedPayslip.dailyRateSnapshot,
                                  )
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Rate / Minute
                            </p>
                            <p className="mt-1 text-sm">
                              {selectedPayslip.ratePerMinuteSnapshot != null
                                ? formatCurrency(
                                    selectedPayslip.ratePerMinuteSnapshot,
                                  )
                                : "—"}
                            </p>
                          </div>
                        </div>
                        {selectedPayslip.notes ? (
                          <div className="mt-4 rounded-lg border border-border/70 bg-background/70 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Notes
                            </p>
                            <p className="mt-1 text-sm">
                              {selectedPayslip.notes}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </>
              )
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isEmployeeHistoryView ? (
        <Dialog
          open={Boolean(selectedPayslipId)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedPayslipId(null);
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto border-none bg-transparent p-0 shadow-none sm:max-w-5xl">
            <DialogHeader className="sr-only">
              <DialogTitle>Payslip Breakdown</DialogTitle>
            </DialogHeader>
            {loadingDetail ? (
              <div className="rounded-2xl border border-border/70 bg-background p-6 shadow-sm">
                <p className="text-sm text-muted-foreground">
                  Loading payslip details...
                </p>
              </div>
            ) : null}
            {!loadingDetail && detailError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive shadow-sm">
                {detailError}
              </div>
            ) : null}
            {!loadingDetail && !detailError && selectedPayslip ? (
              <EmployeePayslipDetail payslip={selectedPayslip} />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
};

export default PayrollPayslipsPage;
