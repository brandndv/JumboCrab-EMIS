"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createEmployeeDeductionAssignment,
  getEmployeeDeductionAssignment,
  listDeductionTypes,
  listEmployeesForDeduction,
  updateEmployeeDeductionAssignment,
  type DeductionEmployeeOption,
  type DeductionTypeRow,
} from "@/actions/deductions/deductions-action";
import {
  formatEmployeeLabel,
  formatMoney,
} from "@/features/manage-deductions/deduction-ui-helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  InlineLoadingState,
  ModuleLoadingState,
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
import { useToast } from "@/components/ui/toast-provider";
import { DeductionAmountMode, DeductionFrequency, EmployeeDeductionAssignmentStatus } from "@prisma/client";

const toDateInputValue = (value?: string | null) =>
  value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);

const toOptionalDateInputValue = (value?: string | null) =>
  value ? value.slice(0, 10) : "";

type DeductionAssignmentFormPageProps = {
  mode: "draft" | "approved";
  cancelPath: string;
  successPath?: string;
  title: string;
  description: string;
};

export default function DeductionAssignmentFormPage({
  mode,
  cancelPath,
  successPath,
  title,
  description,
}: DeductionAssignmentFormPageProps) {
  return (
    <Suspense fallback={<DeductionAssignmentFormFallback title={title} description={description} />}>
      <DeductionAssignmentFormPageContent
        mode={mode}
        cancelPath={cancelPath}
        successPath={successPath}
        title={title}
        description={description}
      />
    </Suspense>
  );
}

function DeductionAssignmentFormFallback({
  title,
  description,
}: Pick<DeductionAssignmentFormPageProps, "title" | "description">) {
  return <ModuleLoadingState title={title} description={description} />;
}

function DeductionAssignmentFormPageContent({
  mode,
  cancelPath,
  successPath,
  title,
  description,
}: DeductionAssignmentFormPageProps) {
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignmentId");

  const [employees, setEmployees] = useState<DeductionEmployeeOption[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [hasLoadedEmployees, setHasLoadedEmployees] = useState(false);
  const employeeSearchActivatedRef = useRef(false);
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const [types, setTypes] = useState<DeductionTypeRow[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [hasLoadedTypes, setHasLoadedTypes] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [typeQuery, setTypeQuery] = useState("");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [effectiveTo, setEffectiveTo] = useState("");
  const [status, setStatus] = useState<EmployeeDeductionAssignmentStatus>(
    EmployeeDeductionAssignmentStatus.ACTIVE,
  );
  const [amountOverride, setAmountOverride] = useState("");
  const [amountOverrideOpen, setAmountOverrideOpen] = useState(false);
  const [percentOverride, setPercentOverride] = useState("");
  const [installmentTotal, setInstallmentTotal] = useState("");
  const [installmentPerPayroll, setInstallmentPerPayroll] = useState("");
  const [existingRemainingBalance, setExistingRemainingBalance] = useState<
    number | null
  >(null);
  const [reason, setReason] = useState("");

  const [loadingExisting, setLoadingExisting] = useState(false);
  const [hasResolvedExisting, setHasResolvedExisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inferredSuccessPath = useMemo(() => {
    if (successPath) return successPath;
    const rolePath = pathname.split("/").filter(Boolean)[0] || "manager";
    return mode === "draft" ? `/${rolePath}/deductions` : `/${rolePath}/deductions/employee`;
  }, [mode, pathname, successPath]);

  const selectedType = useMemo(
    () => types.find((row) => row.id === selectedTypeId) ?? null,
    [selectedTypeId, types],
  );

  const showAmountOverride =
    selectedType?.amountMode === DeductionAmountMode.FIXED &&
    selectedType.frequency !== DeductionFrequency.INSTALLMENT;

  const installmentTotalNumber = useMemo(() => {
    const parsed = Number(installmentTotal);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [installmentTotal]);

  const amountOverrideNumber = useMemo(() => {
    const parsed = Number(amountOverride);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }, [amountOverride]);

  const installmentPerPayrollNumber = useMemo(() => {
    const parsed = Number(installmentPerPayroll);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [installmentPerPayroll]);

  const installmentRemainingBalance = useMemo(() => {
    if (existingRemainingBalance != null) return existingRemainingBalance;
    return installmentTotalNumber;
  }, [existingRemainingBalance, installmentTotalNumber]);

  const installmentEstimatedPayrolls = useMemo(() => {
    if (!installmentTotalNumber || !installmentPerPayrollNumber) return null;
    return Math.max(1, Math.ceil(installmentTotalNumber / installmentPerPayrollNumber));
  }, [installmentPerPayrollNumber, installmentTotalNumber]);

  const installmentSettledAmount = useMemo(() => {
    if (!installmentTotalNumber || installmentRemainingBalance == null) return 0;
    return Math.max(0, installmentTotalNumber - installmentRemainingBalance);
  }, [installmentRemainingBalance, installmentTotalNumber]);

  const displayedFixedAmount = useMemo(() => {
    if (amountOverrideOpen && amountOverrideNumber != null) {
      return amountOverrideNumber;
    }
    return selectedType?.defaultAmount ?? 0;
  }, [amountOverrideNumber, amountOverrideOpen, selectedType?.defaultAmount]);

  const employeeSuggestions = useMemo(() => {
    const term = employeeQuery.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      formatEmployeeLabel(employee).toLowerCase().includes(term),
    );
  }, [employeeQuery, employees]);

  const typeSuggestions = useMemo(() => {
    const term = typeQuery.trim().toLowerCase();
    if (!term) return types;
    return types.filter((type) =>
      `${type.name} ${type.description ?? ""}`.toLowerCase().includes(term),
    );
  }, [typeQuery, types]);

  const loadEmployees = useCallback(async (query: string) => {
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
      const rows = result.data ?? [];
      setEmployees(rows);

      const selected = rows.find((row) => row.employeeId === selectedEmployeeId);
      if (selected) {
        setEmployeeQuery((current) => current || formatEmployeeLabel(selected));
      }
    } catch (err) {
      setEmployees([]);
      setError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setEmployeesLoading(false);
      setHasLoadedEmployees(true);
    }
  }, [selectedEmployeeId]);

  const loadTypes = useCallback(async () => {
    try {
      setTypesLoading(true);
      const result = await listDeductionTypes();
      if (!result.success) {
        throw new Error(result.error || "Failed to load deduction types");
      }
      const rows = result.data ?? [];
      setTypes(rows);
      setSelectedTypeId((current) => current || rows[0]?.id || "");
      setTypeQuery((current) => current || rows[0]?.name || "");
    } catch (err) {
      setTypes([]);
      setError(
        err instanceof Error ? err.message : "Failed to load deduction types",
      );
    } finally {
      setTypesLoading(false);
      setHasLoadedTypes(true);
    }
  }, []);

  const loadExisting = useCallback(async (id: string) => {
    try {
      setLoadingExisting(true);
      const result = await getEmployeeDeductionAssignment(id);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to load deduction assignment");
      }

      setSelectedEmployeeId(result.data.employeeId);
      setEmployeeQuery(
        `${result.data.employeeCode} - ${result.data.employeeName}`,
      );
      setSelectedTypeId(result.data.deductionTypeId);
      setTypeQuery(result.data.deductionName);
      setEffectiveFrom(toDateInputValue(result.data.effectiveFrom));
      setEffectiveTo(toOptionalDateInputValue(result.data.effectiveTo));
      setStatus(result.data.status);
      setAmountOverride(
        typeof result.data.amountOverride === "number"
          ? String(result.data.amountOverride)
          : "",
      );
      setAmountOverrideOpen(typeof result.data.amountOverride === "number");
      setPercentOverride(
        typeof result.data.percentOverride === "number"
          ? String(result.data.percentOverride)
          : "",
      );
      setInstallmentTotal(
        typeof result.data.installmentTotal === "number"
          ? String(result.data.installmentTotal)
          : "",
      );
      setInstallmentPerPayroll(
        typeof result.data.installmentPerPayroll === "number"
          ? String(result.data.installmentPerPayroll)
          : "",
      );
      setExistingRemainingBalance(
        typeof result.data.remainingBalance === "number"
          ? result.data.remainingBalance
          : null,
      );
      setReason(result.data.reason ?? "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load deduction assignment",
      );
    } finally {
      setLoadingExisting(false);
      setHasResolvedExisting(true);
    }
  }, []);

  const selectEmployee = (employee: DeductionEmployeeOption) => {
    setSelectedEmployeeId(employee.employeeId);
    setEmployeeQuery(formatEmployeeLabel(employee));
    setEmployeeDropdownOpen(false);
  };

  const selectType = (type: DeductionTypeRow) => {
    setSelectedTypeId(type.id);
    setTypeQuery(type.name);
    setTypeDropdownOpen(false);
  };

  const submit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      if (!selectedEmployeeId) {
        throw new Error("Please select an employee");
      }
      if (!selectedTypeId) {
        throw new Error("Please select a deduction type");
      }

      const payload = {
        id: assignmentId ?? undefined,
        employeeId: selectedEmployeeId,
        deductionTypeId: selectedTypeId,
        effectiveFrom,
        effectiveTo,
        amountOverride: showAmountOverride ? amountOverride : "",
        percentOverride,
        installmentTotal,
        installmentPerPayroll,
        status,
        reason,
      };

      const result = assignmentId
        ? await updateEmployeeDeductionAssignment(payload)
        : await createEmployeeDeductionAssignment(payload);

      if (!result.success) {
        throw new Error(result.error || "Failed to save deduction assignment");
      }

      toast.success(
        assignmentId
          ? "Deduction assignment updated successfully."
          : "Deduction assignment created successfully.",
      );
      router.push(inferredSuccessPath);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to save deduction assignment";
      setError(message);
      toast.error("Failed to save deduction assignment.", {
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadEmployees(""), loadTypes()]);
  }, [loadEmployees, loadTypes]);

  useEffect(() => {
    if (assignmentId) {
      void loadExisting(assignmentId);
    } else {
      setHasResolvedExisting(true);
    }
  }, [assignmentId, loadExisting]);

  useEffect(() => {
    if (!employeeSearchActivatedRef.current) {
      return;
    }

    const handle = setTimeout(() => {
      void loadEmployees(employeeQuery);
    }, 250);
    return () => clearTimeout(handle);
  }, [employeeQuery, loadEmployees]);

  useEffect(() => {
    if (selectedType?.frequency === DeductionFrequency.INSTALLMENT) {
      setAmountOverride("");
      setAmountOverrideOpen(false);
    }
  }, [selectedType?.frequency]);

  useEffect(() => {
    if (!showAmountOverride) {
      setAmountOverrideOpen(false);
    }
  }, [showAmountOverride]);

  const isInitialPageLoading =
    !error &&
    (!hasLoadedEmployees || !hasLoadedTypes || !hasResolvedExisting);

  if (isInitialPageLoading) {
    return <ModuleLoadingState title={title} description={description} />;
  }

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="space-y-6 pt-6">
          {loadingExisting ? (
            <InlineLoadingState
              label="Loading deduction assignment"
              lines={3}
              className="border-border/60 bg-muted/10"
            />
          ) : null}

          <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
            <div>
              <h2 className="text-sm font-semibold">Assignment Basics</h2>
              <p className="text-xs text-muted-foreground">
                Choose the employee, pick the deduction, and confirm whether it
                should currently apply in payroll.
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_14rem] xl:items-start">
              <div className="space-y-2">
                <Label htmlFor="deduction-employee">Employee</Label>
                <div className="relative">
                  <Input
                    id="deduction-employee"
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
                    autoComplete="off"
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
                <p className="text-xs text-muted-foreground">
                  Search by employee name or employee code.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deduction-type-search">Deduction Type</Label>
                <div className="relative">
                  <Input
                    id="deduction-type-search"
                    value={typeQuery}
                    onChange={(event) => {
                      setTypeQuery(event.target.value);
                      setSelectedTypeId("");
                      setTypeDropdownOpen(true);
                    }}
                    onFocus={() => setTypeDropdownOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setTypeDropdownOpen(false), 120);
                    }}
                    placeholder={
                      typesLoading ? "Loading types..." : "Search deduction type"
                    }
                    autoComplete="off"
                  />
                  {typeDropdownOpen ? (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                      {typeSuggestions.length > 0 ? (
                        typeSuggestions.slice(0, 20).map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              selectType(type);
                            }}
                          >
                            <span className="block font-medium">{type.name}</span>
                            {type.description ? (
                              <span className="block text-xs text-muted-foreground">
                                {type.description}
                              </span>
                            ) : null}
                          </button>
                        ))
                      ) : (
                        <div className="px-2 py-2 text-sm text-muted-foreground">
                          No deduction types found.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                {selectedType ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedType.amountMode === DeductionAmountMode.FIXED
                      ? `Default: ${selectedType.defaultAmount ?? 0}`
                      : `Default: ${selectedType.defaultPercent ?? 0}%`}{" "}
                    •{" "}
                    {selectedType.frequency === DeductionFrequency.ONE_TIME
                      ? "One-time"
                      : selectedType.frequency === DeductionFrequency.INSTALLMENT
                        ? "Installment"
                        : "Per payroll"}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Choose one type from the list to continue.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Runtime Status</Label>
                <Select
                  value={status}
                  onValueChange={(value: EmployeeDeductionAssignmentStatus) =>
                    setStatus(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EmployeeDeductionAssignmentStatus.ACTIVE}>
                      Active
                    </SelectItem>
                    <SelectItem value={EmployeeDeductionAssignmentStatus.PAUSED}>
                      Paused
                    </SelectItem>
                    <SelectItem value={EmployeeDeductionAssignmentStatus.COMPLETED}>
                      Completed
                    </SelectItem>
                    <SelectItem value={EmployeeDeductionAssignmentStatus.CANCELLED}>
                      Cancelled
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Active deductions can be applied by payroll once approved.
                </p>
              </div>
            </div>
          </div>

          {showAmountOverride ? (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <Label>Deduction Amount</Label>
                  <p className="text-xs text-muted-foreground">
                    Default amount from this deduction type.
                  </p>
                </div>
                <div className="flex gap-2">
                  {amountOverrideOpen ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAmountOverride("");
                        setAmountOverrideOpen(false);
                      }}
                    >
                      Remove Override
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAmountOverrideOpen(true)}
                    >
                      Override Amount
                    </Button>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {amountOverrideOpen ? "Applied Amount" : "Default Amount"}
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {formatMoney(displayedFixedAmount)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {amountOverrideOpen
                    ? `Type default ${formatMoney(selectedType?.defaultAmount ?? 0)}`
                    : "Using the deduction type default amount."}
                </p>
              </div>

              {amountOverrideOpen ? (
                <div className="space-y-2">
                  <Label htmlFor="deduction-amount-override">
                    Override Amount
                  </Label>
                  <Input
                    id="deduction-amount-override"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountOverride}
                    onChange={(event) => setAmountOverride(event.target.value)}
                    placeholder="Enter custom amount"
                  />
                  <p className="text-xs text-muted-foreground">
                    This employee will use the override amount instead of the
                    deduction type default.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {selectedType?.amountMode === DeductionAmountMode.PERCENT ? (
            <div className="space-y-2">
              <Label htmlFor="deduction-percent-override">
                Percent Override
              </Label>
              <Input
                id="deduction-percent-override"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={percentOverride}
                onChange={(event) => setPercentOverride(event.target.value)}
                placeholder="Leave blank to use type default"
              />
            </div>
          ) : null}

          {selectedType?.frequency === DeductionFrequency.INSTALLMENT ? (
            <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div>
                <h2 className="text-sm font-semibold">Installment Details</h2>
                <p className="text-xs text-muted-foreground">
                  Set the full amount and how much should be taken every payroll.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deduction-installment-total">
                    Total Amount
                  </Label>
                  <Input
                    id="deduction-installment-total"
                    type="number"
                    min="0"
                    step="0.01"
                    value={installmentTotal}
                    onChange={(event) => {
                      setInstallmentTotal(event.target.value);
                      if (!assignmentId) {
                        setExistingRemainingBalance(null);
                      }
                    }}
                    placeholder="Enter installment total"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deduction-installment-per-payroll">
                    Amount Per Payroll
                  </Label>
                  <Input
                    id="deduction-installment-per-payroll"
                    type="number"
                    min="0"
                    step="0.01"
                    value={installmentPerPayroll}
                    onChange={(event) =>
                      setInstallmentPerPayroll(event.target.value)
                    }
                    placeholder="Enter payroll deduction amount"
                  />
                </div>
              </div>

              <div className="grid gap-4 rounded-xl border border-border/60 bg-background p-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Total
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatMoney(installmentTotalNumber ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Per Payroll
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatMoney(installmentPerPayrollNumber ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Current Balance
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatMoney(installmentRemainingBalance ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Estimated Payrolls
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {installmentEstimatedPayrolls ?? "-"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="uppercase tracking-[0.2em] text-muted-foreground">
                    Repayment Preview
                  </span>
                  <span className="font-medium text-foreground">
                    {installmentEstimatedPayrolls && installmentPerPayrollNumber
                      ? `${(installmentSettledAmount / installmentPerPayrollNumber).toFixed(installmentSettledAmount % installmentPerPayrollNumber === 0 ? 0 : 1)} / ${installmentEstimatedPayrolls}`
                      : "Waiting for amounts"}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-all"
                    style={{
                      width: `${
                        installmentTotalNumber && installmentRemainingBalance != null
                          ? Math.min(
                              100,
                              Math.max(
                                0,
                                ((installmentSettledAmount /
                                  installmentTotalNumber) *
                                  100),
                              ),
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {assignmentId
                    ? "Use Record Payment after approval to settle the balance ahead of payroll."
                    : "The balance starts at the total amount and reduces after released payrolls or manual payments."}
                </p>
              </div>
            </div>
          ) : null}

          <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
            <div>
              <h2 className="text-sm font-semibold">Deduction Schedule</h2>
              <p className="text-xs text-muted-foreground">
                The start date defaults to today on create. Leave the end date blank
                unless this deduction should stop on a specific date.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deduction-effective-from">Effective From</Label>
                <Input
                  id="deduction-effective-from"
                  type="date"
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Prefilled to the date this assignment is created. You can still
                  adjust it if the deduction starts later.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deduction-effective-to">Effective To</Label>
                <Input
                  id="deduction-effective-to"
                  type="date"
                  value={effectiveTo}
                  onChange={(event) => setEffectiveTo(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {selectedType?.frequency === DeductionFrequency.INSTALLMENT
                    ? "Leave blank until the installment is fully settled."
                    : "Leave blank if this deduction should stay active until you stop it manually."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deduction-reason">Reason</Label>
            <Input
              id="deduction-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                mode === "draft"
                  ? "Why this draft should be reviewed"
                  : "Why this deduction is being assigned"
              }
            />
          </div>

          {assignmentId && mode === "draft" ? (
            <p className="text-xs text-muted-foreground">
              Saving this record will resubmit it as a draft for manager review.
            </p>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(cancelPath)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={submitting || loadingExisting}
            >
              {submitting
                ? "Saving..."
                : assignmentId
                  ? mode === "draft"
                    ? "Save And Resubmit"
                    : "Save Changes"
                  : mode === "draft"
                    ? "Create Draft"
                    : "Assign Deduction"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
