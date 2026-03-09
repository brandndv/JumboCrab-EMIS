"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createViolationAutoResetPolicy,
  deleteViolationAutoResetPolicy,
  getEmployeeViolationStrikeProgress,
  getViolations,
  listEmployeeViolationResets,
  listEmployeesForViolation,
  listViolationAutoResetPolicies,
  listViolationDefinitions,
  resetEmployeeViolationStrikes,
  runDueViolationAutoResets,
  runViolationAutoResetPolicyNow,
  setViolationAutoResetPolicyActive,
  updateViolationAutoResetPolicy,
  type EmployeeViolationResetRow,
  type ViolationAutoResetPolicyRow,
  type ViolationDefinitionOption,
  type ViolationEmployeeOption,
  type ViolationRow,
  type ViolationStrikeProgressRow,
} from "@/actions/violations/violations-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type EmployeeViolationsDirectoryPageProps = {
  rolePath: "manager" | "generalManager";
};

const ALL_TYPES_VALUE = "__ALL_TYPES__";
type AutoResetFrequency = ViolationAutoResetPolicyRow["frequency"];

const getTodayDateInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatEmployeeLabel = (employee: ViolationEmployeeOption) =>
  `${employee.employeeCode} - ${employee.firstName} ${employee.lastName}`;

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

const toDateInputValue = (value: string | null | undefined) => {
  if (!value) return getTodayDateInput();
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return normalized.slice(0, 10);
};

const EmployeeViolationsDirectoryPage = ({
  rolePath,
}: EmployeeViolationsDirectoryPageProps) => {
  const [employees, setEmployees] = useState<ViolationEmployeeOption[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] =
    useState<boolean>(false);
  const [employeesLoading, setEmployeesLoading] = useState<boolean>(false);

  const [definitions, setDefinitions] = useState<ViolationDefinitionOption[]>(
    [],
  );
  const [rows, setRows] = useState<ViolationRow[]>([]);
  const [loadingViolations, setLoadingViolations] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [strikeProgress, setStrikeProgress] = useState<
    ViolationStrikeProgressRow[]
  >([]);
  const [loadingStrikeProgress, setLoadingStrikeProgress] =
    useState<boolean>(false);
  const [strikeProgressError, setStrikeProgressError] = useState<string | null>(
    null,
  );

  const [resetRows, setResetRows] = useState<EmployeeViolationResetRow[]>([]);
  const [loadingResetRows, setLoadingResetRows] = useState<boolean>(false);
  const [resetRowsError, setResetRowsError] = useState<string | null>(null);

  const [resetEffectiveFrom, setResetEffectiveFrom] = useState<string>(
    getTodayDateInput(),
  );
  const [resetReason, setResetReason] = useState<string>("");
  const [resetViolationId, setResetViolationId] = useState<string>(
    ALL_TYPES_VALUE,
  );
  const [submittingReset, setSubmittingReset] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const [policies, setPolicies] = useState<ViolationAutoResetPolicyRow[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState<boolean>(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const [autoName, setAutoName] = useState<string>("");
  const [autoScope, setAutoScope] = useState<"all" | "selected">("selected");
  const [autoFrequency, setAutoFrequency] =
    useState<AutoResetFrequency>("MONTHLY");
  const [autoDayOfMonth, setAutoDayOfMonth] = useState<string>("1");
  const [autoMonthOfYear, setAutoMonthOfYear] = useState<string>("1");
  const [autoEffectiveFrom, setAutoEffectiveFrom] = useState<string>(
    getTodayDateInput(),
  );
  const [autoViolationId, setAutoViolationId] = useState<string>(ALL_TYPES_VALUE);
  const [autoReasonTemplate, setAutoReasonTemplate] = useState<string>("");
  const [creatingPolicy, setCreatingPolicy] = useState<boolean>(false);
  const [editPolicyOpen, setEditPolicyOpen] = useState<boolean>(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string>("");
  const [isEditingViewedPolicy, setIsEditingViewedPolicy] =
    useState<boolean>(false);
  const [editPolicyEmployeeId, setEditPolicyEmployeeId] = useState<string>("");
  const [editAutoName, setEditAutoName] = useState<string>("");
  const [editAutoScope, setEditAutoScope] = useState<"all" | "selected">("selected");
  const [editAutoFrequency, setEditAutoFrequency] =
    useState<AutoResetFrequency>("MONTHLY");
  const [editAutoDayOfMonth, setEditAutoDayOfMonth] = useState<string>("1");
  const [editAutoMonthOfYear, setEditAutoMonthOfYear] = useState<string>("1");
  const [editAutoEffectiveFrom, setEditAutoEffectiveFrom] = useState<string>(
    getTodayDateInput(),
  );
  const [editAutoViolationId, setEditAutoViolationId] =
    useState<string>(ALL_TYPES_VALUE);
  const [editAutoReasonTemplate, setEditAutoReasonTemplate] = useState<string>("");
  const [savingEditedPolicy, setSavingEditedPolicy] = useState<boolean>(false);
  const [runningAutoNow, setRunningAutoNow] = useState<boolean>(false);
  const [runningViewedPolicy, setRunningViewedPolicy] = useState<boolean>(false);
  const [togglingViewedPolicy, setTogglingViewedPolicy] = useState<boolean>(false);
  const [deletingViewedPolicy, setDeletingViewedPolicy] = useState<boolean>(false);
  const [autoActionMessage, setAutoActionMessage] = useState<string | null>(null);

  const loadDefinitions = async () => {
    try {
      const result = await listViolationDefinitions();
      if (!result.success) {
        throw new Error(result.error || "Failed to load violation definitions");
      }
      setDefinitions(result.data ?? []);
    } catch (err) {
      setPolicyError(
        err instanceof Error
          ? err.message
          : "Failed to load violation definitions",
      );
    }
  };

  const loadEmployees = async (query: string) => {
    try {
      setEmployeesLoading(true);
      const result = await listEmployeesForViolation({
        query,
        employeeId: selectedEmployeeId || undefined,
        limit: 80,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to load employees");
      }
      setEmployees(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const loadViolations = async (employeeId: string) => {
    if (!employeeId) {
      setRows([]);
      return;
    }

    try {
      setLoadingViolations(true);
      setError(null);
      const result = await getViolations({ employeeId });
      if (!result.success) {
        throw new Error(result.error || "Failed to load employee violations");
      }
      setRows(result.data ?? []);
    } catch (err) {
      setRows([]);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load employee violations",
      );
    } finally {
      setLoadingViolations(false);
    }
  };

  const loadStrikeProgress = async (employeeId: string) => {
    if (!employeeId) {
      setStrikeProgress([]);
      return;
    }

    try {
      setLoadingStrikeProgress(true);
      setStrikeProgressError(null);
      const result = await getEmployeeViolationStrikeProgress({ employeeId });
      if (!result.success) {
        throw new Error(result.error || "Failed to load strike progress");
      }
      setStrikeProgress(result.data ?? []);
    } catch (err) {
      setStrikeProgress([]);
      setStrikeProgressError(
        err instanceof Error ? err.message : "Failed to load strike progress",
      );
    } finally {
      setLoadingStrikeProgress(false);
    }
  };

  const loadResetRows = async (employeeId: string) => {
    if (!employeeId) {
      setResetRows([]);
      return;
    }

    try {
      setLoadingResetRows(true);
      setResetRowsError(null);
      const result = await listEmployeeViolationResets({ employeeId, limit: 20 });
      if (!result.success) {
        throw new Error(result.error || "Failed to load reset history");
      }
      setResetRows(result.data ?? []);
    } catch (err) {
      setResetRows([]);
      setResetRowsError(
        err instanceof Error ? err.message : "Failed to load reset history",
      );
    } finally {
      setLoadingResetRows(false);
    }
  };

  const loadPolicies = async () => {
    try {
      setLoadingPolicies(true);
      setPolicyError(null);
      const result = await listViolationAutoResetPolicies();
      if (!result.success) {
        throw new Error(result.error || "Failed to load auto reset policies");
      }
      setPolicies(result.data ?? []);
    } catch (err) {
      setPolicies([]);
      setPolicyError(
        err instanceof Error
          ? err.message
          : "Failed to load auto reset policies",
      );
    } finally {
      setLoadingPolicies(false);
    }
  };

  const refreshSelectedEmployeeData = async (employeeId: string) => {
    if (!employeeId) {
      setRows([]);
      setStrikeProgress([]);
      setResetRows([]);
      return;
    }

    await Promise.all([
      loadViolations(employeeId),
      loadStrikeProgress(employeeId),
      loadResetRows(employeeId),
    ]);
  };

  const employeeSuggestions = useMemo(() => {
    const term = employeeQuery.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      formatEmployeeLabel(employee).toLowerCase().includes(term),
    );
  }, [employees, employeeQuery]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.employeeId === selectedEmployeeId),
    [employees, selectedEmployeeId],
  );
  const editingPolicy = useMemo(
    () => policies.find((policy) => policy.id === editingPolicyId) ?? null,
    [policies, editingPolicyId],
  );
  const editScopedEmployeeLabel = useMemo(() => {
    if (editingPolicy?.employeeCode || editingPolicy?.employeeName) {
      return [editingPolicy.employeeCode, editingPolicy.employeeName]
        .filter(Boolean)
        .join(" - ");
    }
    if (editPolicyEmployeeId && selectedEmployeeId === editPolicyEmployeeId && selectedEmployee) {
      return formatEmployeeLabel(selectedEmployee);
    }
    if (editPolicyEmployeeId) {
      const scoped = employees.find(
        (employee) => employee.employeeId === editPolicyEmployeeId,
      );
      if (scoped) return formatEmployeeLabel(scoped);
      return editPolicyEmployeeId;
    }
    if (selectedEmployeeId && selectedEmployee) {
      return formatEmployeeLabel(selectedEmployee);
    }
    return editPolicyEmployeeId || "No employee selected";
  }, [
    employees,
    editPolicyEmployeeId,
    editingPolicy?.employeeCode,
    editingPolicy?.employeeName,
    selectedEmployee,
    selectedEmployeeId,
  ]);

  const approvedCount = useMemo(
    () => rows.filter((row) => row.status === "APPROVED").length,
    [rows],
  );
  const countedStrikes = useMemo(
    () =>
      rows
        .filter((row) => row.isCountedForStrike)
        .reduce(
          (total, row) => total + Math.max(0, row.strikePointsSnapshot),
          0,
        ),
    [rows],
  );
  const canEditViewedPolicyFields = isEditingViewedPolicy && !savingEditedPolicy;

  const selectEmployee = (employee: ViolationEmployeeOption) => {
    setSelectedEmployeeId(employee.employeeId);
    setEmployeeQuery(formatEmployeeLabel(employee));
    setEmployeeDropdownOpen(false);
    void refreshSelectedEmployeeData(employee.employeeId);
  };

  const resetAutoPolicyCreateForm = () => {
    setAutoName("");
    setAutoScope("selected");
    setAutoFrequency("MONTHLY");
    setAutoDayOfMonth("1");
    setAutoMonthOfYear("1");
    setAutoEffectiveFrom(getTodayDateInput());
    setAutoViolationId(ALL_TYPES_VALUE);
    setAutoReasonTemplate("");
  };

  const populatePolicyModalForm = (policy: ViolationAutoResetPolicyRow) => {
    setEditingPolicyId(policy.id);
    setEditAutoName(policy.name ?? "");
    setEditAutoScope(policy.appliesToAllEmployees ? "all" : "selected");
    setEditPolicyEmployeeId(policy.employeeId ?? "");
    setEditAutoFrequency(policy.frequency);
    setEditAutoDayOfMonth(String(policy.dayOfMonth));
    setEditAutoMonthOfYear(String(policy.monthOfYear ?? 1));
    setEditAutoEffectiveFrom(toDateInputValue(policy.effectiveFrom));
    setEditAutoViolationId(policy.violationId ?? ALL_TYPES_VALUE);
    setEditAutoReasonTemplate(policy.reasonTemplate ?? "");
  };

  const startEditPolicy = (policy: ViolationAutoResetPolicyRow) => {
    populatePolicyModalForm(policy);
    setIsEditingViewedPolicy(false);
    setAutoActionMessage(null);
    setPolicyError(null);
    setEditPolicyOpen(true);
  };

  const closeEditPolicy = () => {
    setEditPolicyOpen(false);
    setEditingPolicyId("");
    setIsEditingViewedPolicy(false);
    setEditPolicyEmployeeId("");
    setRunningViewedPolicy(false);
    setTogglingViewedPolicy(false);
    setDeletingViewedPolicy(false);
  };

  const cancelViewedPolicyEdit = () => {
    if (editingPolicy) {
      populatePolicyModalForm(editingPolicy);
    }
    setIsEditingViewedPolicy(false);
    setPolicyError(null);
  };

  const submitManualReset = async () => {
    if (!selectedEmployeeId) {
      setResetError("Select an employee first.");
      return;
    }

    const reason = resetReason.trim();
    if (!reason) {
      setResetError("Reason is required.");
      return;
    }

    try {
      setSubmittingReset(true);
      setResetError(null);
      setResetSuccess(null);
      const result = await resetEmployeeViolationStrikes({
        employeeId: selectedEmployeeId,
        violationId:
          resetViolationId === ALL_TYPES_VALUE ? null : resetViolationId,
        effectiveFrom: resetEffectiveFrom,
        reason,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to reset strikes");
      }

      setResetSuccess("Violation strike reset recorded.");
      setResetReason("");
      await refreshSelectedEmployeeData(selectedEmployeeId);
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : "Failed to reset strikes",
      );
    } finally {
      setSubmittingReset(false);
    }
  };

  const submitAutoPolicy = async () => {
    try {
      setCreatingPolicy(true);
      setPolicyError(null);
      setAutoActionMessage(null);

      if (autoScope === "selected" && !selectedEmployeeId) {
        throw new Error("Select an employee first for scoped auto reset.");
      }

      const dayOfMonth = Number.parseInt(autoDayOfMonth, 10);
      const monthOfYear = Number.parseInt(autoMonthOfYear, 10);

      const policyPayload = {
        name: autoName.trim() || null,
        frequency: autoFrequency,
        dayOfMonth: Number.isFinite(dayOfMonth) ? dayOfMonth : 1,
        monthOfYear:
          autoFrequency === "YEARLY" || autoFrequency === "QUARTERLY"
            ? Number.isFinite(monthOfYear)
              ? monthOfYear
              : 1
            : null,
        effectiveFrom: autoEffectiveFrom,
        reasonTemplate: autoReasonTemplate.trim() || null,
        appliesToAllEmployees: autoScope === "all",
        employeeId: autoScope === "selected" ? selectedEmployeeId : null,
        violationId: autoViolationId === ALL_TYPES_VALUE ? null : autoViolationId,
      };

      const result = await createViolationAutoResetPolicy({
        ...policyPayload,
        isActive: true,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to create auto reset policy");
      }

      setAutoActionMessage("Auto-reset policy created.");
      resetAutoPolicyCreateForm();
      await loadPolicies();
    } catch (err) {
      setPolicyError(
        err instanceof Error
          ? err.message
          : "Failed to create auto reset policy",
      );
    } finally {
      setCreatingPolicy(false);
    }
  };

  const submitEditedPolicy = async () => {
    if (!editingPolicyId) {
      setPolicyError("Select a policy to edit.");
      return;
    }

    try {
      setSavingEditedPolicy(true);
      setPolicyError(null);
      setAutoActionMessage(null);

      const dayOfMonth = Number.parseInt(editAutoDayOfMonth, 10);
      const monthOfYear = Number.parseInt(editAutoMonthOfYear, 10);
      const scopedEmployeeId =
        editAutoScope === "selected"
          ? editPolicyEmployeeId || selectedEmployeeId
          : null;

      if (editAutoScope === "selected" && !scopedEmployeeId) {
        throw new Error("Select an employee first for scoped auto reset.");
      }

      const result = await updateViolationAutoResetPolicy({
        id: editingPolicyId,
        name: editAutoName.trim() || null,
        frequency: editAutoFrequency,
        dayOfMonth: Number.isFinite(dayOfMonth) ? dayOfMonth : 1,
        monthOfYear:
          editAutoFrequency === "YEARLY" || editAutoFrequency === "QUARTERLY"
            ? Number.isFinite(monthOfYear)
              ? monthOfYear
              : 1
            : null,
        effectiveFrom: editAutoEffectiveFrom,
        reasonTemplate: editAutoReasonTemplate.trim() || null,
        appliesToAllEmployees: editAutoScope === "all",
        employeeId: scopedEmployeeId,
        violationId:
          editAutoViolationId === ALL_TYPES_VALUE ? null : editAutoViolationId,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to update auto reset policy");
      }

      setAutoActionMessage("Auto-reset policy updated.");
      closeEditPolicy();
      await loadPolicies();
    } catch (err) {
      setPolicyError(
        err instanceof Error ? err.message : "Failed to update auto reset policy",
      );
    } finally {
      setSavingEditedPolicy(false);
    }
  };

  const runAutoResetNow = async () => {
    try {
      setRunningAutoNow(true);
      setPolicyError(null);
      const result = await runDueViolationAutoResets();
      if (!result.success) {
        throw new Error(result.error || "Failed to run due auto resets");
      }

      const created = result.data?.createdResets ?? 0;
      const processed = result.data?.processedPolicies ?? 0;
      setAutoActionMessage(
        processed === 0
          ? "No due auto-reset policies right now. Use a policy row's Run Now to force one immediately."
          : `Auto-reset run complete. Policies processed: ${processed}, resets created: ${created}.`,
      );

      await Promise.all([
        loadPolicies(),
        selectedEmployeeId
          ? refreshSelectedEmployeeData(selectedEmployeeId)
          : Promise.resolve(),
      ]);
    } catch (err) {
      setPolicyError(
        err instanceof Error ? err.message : "Failed to run due auto resets",
      );
    } finally {
      setRunningAutoNow(false);
    }
  };

  const runPolicyNow = async (policyId: string) => {
    try {
      setRunningViewedPolicy(true);
      setPolicyError(null);
      setAutoActionMessage(null);

      const result = await runViolationAutoResetPolicyNow({ id: policyId });
      if (!result.success) {
        throw new Error(result.error || "Failed to run policy now");
      }

      const created = result.data?.createdResets ?? 0;
      const runAtLabel = result.data?.runAt
        ? formatDate(result.data.runAt)
        : "next cycle";
      setAutoActionMessage(
        `Policy run completed. Resets created: ${created}. Effective from ${runAtLabel}.`,
      );

      await Promise.all([
        loadPolicies(),
        selectedEmployeeId
          ? refreshSelectedEmployeeData(selectedEmployeeId)
          : Promise.resolve(),
      ]);
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : "Failed to run policy now");
    } finally {
      setRunningViewedPolicy(false);
    }
  };

  const togglePolicyActive = async (id: string, isActive: boolean) => {
    try {
      setTogglingViewedPolicy(true);
      setPolicyError(null);
      const result = await setViolationAutoResetPolicyActive({
        id,
        isActive: !isActive,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to update policy status");
      }
      setPolicies((prev) =>
        prev.map((policy) =>
          policy.id === id
            ? { ...policy, isActive: !isActive }
            : policy,
        ),
      );
    } catch (err) {
      setPolicyError(
        err instanceof Error ? err.message : "Failed to update policy status",
      );
    } finally {
      setTogglingViewedPolicy(false);
    }
  };

  const deletePolicy = async (id: string) => {
    try {
      setDeletingViewedPolicy(true);
      setPolicyError(null);
      setAutoActionMessage(null);

      const confirmed = window.confirm(
        "Delete this auto reset policy? This cannot be undone.",
      );
      if (!confirmed) return;

      const result = await deleteViolationAutoResetPolicy({ id });
      if (!result.success) {
        throw new Error(result.error || "Failed to delete policy");
      }

      setAutoActionMessage("Auto-reset policy deleted.");
      setPolicies((prev) => prev.filter((policy) => policy.id !== id));
      closeEditPolicy();
      if (selectedEmployeeId) {
        await refreshSelectedEmployeeData(selectedEmployeeId);
      }
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : "Failed to delete policy");
    } finally {
      setDeletingViewedPolicy(false);
    }
  };

  const refresh = async () => {
    setError(null);
    await Promise.all([loadEmployees(employeeQuery), loadDefinitions(), loadPolicies()]);
    if (selectedEmployeeId) {
      await refreshSelectedEmployeeData(selectedEmployeeId);
    }
  };

  useEffect(() => {
    void Promise.all([loadEmployees(""), loadDefinitions(), loadPolicies()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadEmployees(employeeQuery);
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeQuery]);

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Employee Violations</h1>
          <p className="text-sm text-muted-foreground">
            Search an employee, review violations, and manage strike resets.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">Search Employee</CardTitle>
          <div className="relative w-full max-w-xl">
            <Input
              value={employeeQuery}
              onChange={(event) => {
                setEmployeeQuery(event.target.value);
                setSelectedEmployeeId("");
                setRows([]);
                setStrikeProgress([]);
                setResetRows([]);
                setEmployeeDropdownOpen(true);
              }}
              onFocus={() => setEmployeeDropdownOpen(true)}
              onBlur={() => {
                setTimeout(() => setEmployeeDropdownOpen(false), 120);
              }}
              placeholder="Search employee by name or code"
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
            {selectedEmployee
              ? `Selected: ${formatEmployeeLabel(selectedEmployee)}`
              : "Search and select one employee to continue."}
          </p>
          {employeesLoading ? (
            <p className="text-xs text-muted-foreground">Loading employees...</p>
          ) : null}
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
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
              Counted Strikes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{countedStrikes}</p>
          </CardContent>
        </Card>
      </div>

      {selectedEmployeeId && (
        <>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Strike Progress Per Type</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStrikeProgress ? (
                <p className="text-sm text-muted-foreground">Loading strike progress...</p>
              ) : strikeProgressError ? (
                <p className="text-sm text-destructive">{strikeProgressError}</p>
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
                      <div key={item.violationId} className="rounded-lg border p-3">
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

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Manual Reset</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="reset-effective-from">Effective From</Label>
                  <Input
                    id="reset-effective-from"
                    type="date"
                    value={resetEffectiveFrom}
                    onChange={(event) => setResetEffectiveFrom(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Violation Type</Label>
                  <Select value={resetViolationId} onValueChange={setResetViolationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_TYPES_VALUE}>All violation types</SelectItem>
                      {definitions.map((definition) => (
                        <SelectItem
                          key={definition.violationId}
                          value={definition.violationId}
                        >
                          {definition.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-reason">Reason</Label>
                  <textarea
                    id="reset-reason"
                    value={resetReason}
                    onChange={(event) => setResetReason(event.target.value)}
                    placeholder="Why reset is needed"
                    className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => void submitManualReset()}
                  disabled={submittingReset}
                >
                  {submittingReset ? "Saving..." : "Reset Strikes"}
                </Button>
                {resetSuccess ? (
                  <p className="text-sm text-emerald-600">{resetSuccess}</p>
                ) : null}
                {resetError ? (
                  <p className="text-sm text-destructive">{resetError}</p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Reset History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Effective</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingResetRows ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-muted-foreground">
                            Loading reset history...
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {!loadingResetRows && resetRowsError ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-destructive">
                            {resetRowsError}
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {!loadingResetRows && !resetRowsError && resetRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-muted-foreground">
                            No reset history yet.
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {!loadingResetRows &&
                        !resetRowsError &&
                        resetRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{formatDate(row.effectiveFrom)}</TableCell>
                            <TableCell>{row.violationName || "All types"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.reason}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">Auto Reset Policies (Optional)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure monthly/quarterly/yearly automatic resets. Use "Run Due Now" to trigger immediately.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="auto-name">Policy Name (optional)</Label>
              <Input
                id="auto-name"
                value={autoName}
                onChange={(event) => setAutoName(event.target.value)}
                placeholder="Ex: Monthly reset policy"
              />
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={autoScope}
                onValueChange={(value: "all" | "selected") => setAutoScope(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="selected">Selected employee only</SelectItem>
                  <SelectItem value="all">All active employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={autoFrequency}
                onValueChange={(value) =>
                  setAutoFrequency(value as AutoResetFrequency)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto-day">Day of Month</Label>
              <Input
                id="auto-day"
                type="number"
                min={1}
                max={31}
                value={autoDayOfMonth}
                onChange={(event) => setAutoDayOfMonth(event.target.value)}
              />
            </div>
            {autoFrequency === "YEARLY" || autoFrequency === "QUARTERLY" ? (
              <div className="space-y-2">
                <Label htmlFor="auto-month">
                  {autoFrequency === "QUARTERLY"
                    ? "Quarter Start Month"
                    : "Month of Year"}
                </Label>
                <Input
                  id="auto-month"
                  type="number"
                  min={1}
                  max={12}
                  value={autoMonthOfYear}
                  onChange={(event) => setAutoMonthOfYear(event.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Violation Type</Label>
              <Select value={autoViolationId} onValueChange={setAutoViolationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES_VALUE}>All violation types</SelectItem>
                  {definitions.map((definition) => (
                    <SelectItem
                      key={definition.violationId}
                      value={definition.violationId}
                    >
                      {definition.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto-effective-from">Effective From</Label>
              <Input
                id="auto-effective-from"
                type="date"
                value={autoEffectiveFrom}
                onChange={(event) => setAutoEffectiveFrom(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-reason-template">Reason Template (optional)</Label>
            <Input
              id="auto-reason-template"
              value={autoReasonTemplate}
              onChange={(event) => setAutoReasonTemplate(event.target.value)}
              placeholder="Ex: Monthly strike reset"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void submitAutoPolicy()}
              disabled={creatingPolicy}
            >
              {creatingPolicy ? "Saving..." : "Create Auto Policy"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void runAutoResetNow()}
              disabled={runningAutoNow}
            >
              {runningAutoNow ? "Running..." : "Run Due Now"}
            </Button>
          </div>

          {autoActionMessage ? (
            <p className="text-sm text-emerald-600">{autoActionMessage}</p>
          ) : null}
          {policyError ? (
            <p className="text-sm text-destructive">{policyError}</p>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Policy</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPolicies ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Loading policies...
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loadingPolicies && policies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No auto reset policies yet.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loadingPolicies &&
                  policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <p className="font-medium">{policy.name || "Untitled policy"}</p>
                        <p className="text-xs text-muted-foreground">
                          {policy.isActive ? "Active" : "Inactive"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {policy.appliesToAllEmployees
                          ? "All employees"
                          : policy.employeeCode || "Employee"}
                      </TableCell>
                      <TableCell>{policy.violationName || "All types"}</TableCell>
                      <TableCell>
                        {policy.frequency === "YEARLY"
                          ? `Yearly · day ${policy.dayOfMonth} · month ${policy.monthOfYear ?? 1}`
                          : policy.frequency === "QUARTERLY"
                            ? `Quarterly · day ${policy.dayOfMonth} · start month ${policy.monthOfYear ?? 1}`
                            : `Monthly · day ${policy.dayOfMonth}`}
                      </TableCell>
                      <TableCell>{formatDate(policy.nextRunAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditPolicy(policy)}
                          >
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={editPolicyOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeEditPolicy();
            return;
          }
          setEditPolicyOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Policy Details</DialogTitle>
            <DialogDescription>
              View this policy and manage actions from one place. Click Edit to modify fields.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground sm:grid-cols-3">
            <p>
              Status:{" "}
              <span className="font-medium text-foreground">
                {editingPolicy?.isActive ? "Active" : "Inactive"}
              </span>
            </p>
            <p>
              Next run:{" "}
              <span className="font-medium text-foreground">
                {editingPolicy?.nextRunAt
                  ? formatDate(editingPolicy.nextRunAt)
                  : "—"}
              </span>
            </p>
            <p>
              Last run:{" "}
              <span className="font-medium text-foreground">
                {editingPolicy?.lastRunAt
                  ? formatDate(editingPolicy.lastRunAt)
                  : "Never"}
              </span>
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-auto-name">Policy Name (optional)</Label>
              <Input
                id="edit-auto-name"
                value={editAutoName}
                onChange={(event) => setEditAutoName(event.target.value)}
                placeholder="Ex: Quarterly reset policy"
                disabled={!canEditViewedPolicyFields}
              />
            </div>

            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={editAutoScope}
                disabled={!canEditViewedPolicyFields}
                onValueChange={(value: "all" | "selected") => {
                  setEditAutoScope(value);
                  if (value === "selected" && !editPolicyEmployeeId && selectedEmployeeId) {
                    setEditPolicyEmployeeId(selectedEmployeeId);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="selected">Selected employee only</SelectItem>
                  <SelectItem value="all">All active employees</SelectItem>
                </SelectContent>
              </Select>
              {editAutoScope === "selected" ? (
                <p className="text-xs text-muted-foreground">
                  Employee: {editScopedEmployeeLabel}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={editAutoFrequency}
                disabled={!canEditViewedPolicyFields}
                onValueChange={(value) =>
                  setEditAutoFrequency(value as AutoResetFrequency)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-auto-day">Day of Month</Label>
              <Input
                id="edit-auto-day"
                type="number"
                min={1}
                max={31}
                value={editAutoDayOfMonth}
                onChange={(event) => setEditAutoDayOfMonth(event.target.value)}
                disabled={!canEditViewedPolicyFields}
              />
            </div>

            {editAutoFrequency === "YEARLY" || editAutoFrequency === "QUARTERLY" ? (
              <div className="space-y-2">
                <Label htmlFor="edit-auto-month">
                  {editAutoFrequency === "QUARTERLY"
                    ? "Quarter Start Month"
                    : "Month of Year"}
                </Label>
                <Input
                  id="edit-auto-month"
                  type="number"
                  min={1}
                  max={12}
                  value={editAutoMonthOfYear}
                  onChange={(event) => setEditAutoMonthOfYear(event.target.value)}
                  disabled={!canEditViewedPolicyFields}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="edit-auto-effective-from">Effective From</Label>
              <Input
                id="edit-auto-effective-from"
                type="date"
                value={editAutoEffectiveFrom}
                onChange={(event) => setEditAutoEffectiveFrom(event.target.value)}
                disabled={!canEditViewedPolicyFields}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Violation Type</Label>
              <Select
                value={editAutoViolationId}
                disabled={!canEditViewedPolicyFields}
                onValueChange={setEditAutoViolationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES_VALUE}>All violation types</SelectItem>
                  {definitions.map((definition) => (
                    <SelectItem
                      key={definition.violationId}
                      value={definition.violationId}
                    >
                      {definition.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-auto-reason-template">
                Reason Template (optional)
              </Label>
              <Input
                id="edit-auto-reason-template"
                value={editAutoReasonTemplate}
                onChange={(event) => setEditAutoReasonTemplate(event.target.value)}
                placeholder="Ex: Quarterly strike reset"
                disabled={!canEditViewedPolicyFields}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void deletePolicy(editingPolicyId)}
              disabled={deletingViewedPolicy || !editingPolicyId || savingEditedPolicy}
            >
              {deletingViewedPolicy ? "Deleting..." : "Delete"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void runPolicyNow(editingPolicyId)}
              disabled={runningViewedPolicy || !editingPolicyId || savingEditedPolicy}
            >
              {runningViewedPolicy ? "Running..." : "Run Now"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void togglePolicyActive(editingPolicyId, Boolean(editingPolicy?.isActive))
              }
              disabled={togglingViewedPolicy || !editingPolicyId || savingEditedPolicy}
            >
              {togglingViewedPolicy
                ? "Saving..."
                : editingPolicy?.isActive
                  ? "Disable Policy"
                  : "Enable Policy"}
            </Button>
            {isEditingViewedPolicy ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => cancelViewedPolicyEdit()}
                  disabled={savingEditedPolicy}
                >
                  Cancel Edit
                </Button>
                <Button
                  type="button"
                  onClick={() => void submitEditedPolicy()}
                  disabled={savingEditedPolicy || !editingPolicyId}
                >
                  {savingEditedPolicy ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => setIsEditingViewedPolicy(true)}
                disabled={!editingPolicyId}
              >
                Edit
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => closeEditPolicy()}
              disabled={savingEditedPolicy}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Violation Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Violation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Strike</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingViolations ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Loading employee violations...
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loadingViolations && error ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-destructive">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loadingViolations && !error && !selectedEmployeeId ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Select an employee first.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loadingViolations && !error && selectedEmployeeId && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loadingViolations &&
                  !error &&
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.violationDate)}</TableCell>
                      <TableCell>{row.violationName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(row.status)}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.isCountedForStrike
                          ? `${row.strikePointsSnapshot} counted`
                          : "Not counted"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/${rolePath}/employees/${row.employeeId}/view`}>
                            View Employee
                          </Link>
                        </Button>
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

export default EmployeeViolationsDirectoryPage;
