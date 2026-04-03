"use client";

import { getEmployeeContribution } from "@/actions/contributions/contributions-action";
import {
  getGovernmentIdByEmployee,
  upsertGovernmentId,
  type GovernmentIdRecord,
} from "@/actions/contributions/government-ids-action";
import {
  getEmployeeRateHistory,
  type EmployeeActionRecord,
  type EmployeeRateHistoryItem,
  updateEmployee,
} from "@/actions/employees/employees-action";
import {
  getEmployeeViolationStrikeProgress,
  getViolations,
  type ViolationStrikeProgressRow,
  type ViolationRow,
} from "@/actions/violations/violations-action";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IdCard, Loader2, Plus } from "lucide-react";
import EmployeeForm from "./employee-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type EmployeeProfileData = EmployeeActionRecord;

type TabKey = "profile" | "dailyRate" | "violations" | "govIds";

const tabs: { key: TabKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "dailyRate", label: "Daily Rate" },
  { key: "violations", label: "Employee Violations" },
  { key: "govIds", label: "Government IDs" },
];

const getTodayDateInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const govIdFields: {
  key: keyof Pick<
    GovernmentIdRecord,
    "tinNumber" | "sssNumber" | "philHealthNumber" | "pagIbigNumber"
  >;
  label: string;
  helper: string;
}[] = [
  {
    key: "tinNumber",
    label: "TIN (BIR)",
    helper: "Add TIN and keep a reference for 1902/2316 later.",
  },
  {
    key: "sssNumber",
    label: "SSS",
    helper: "Store SSS number; add expiry reminders when ready.",
  },
  {
    key: "philHealthNumber",
    label: "PhilHealth",
    helper: "Track PhilHealth number; dependents can follow later.",
  },
  {
    key: "pagIbigNumber",
    label: "Pag-IBIG",
    helper: "Track Pag-IBIG number; dependents can follow later.",
  },
];

export function EmployeeProfileTabs({
  employee,
}: {
  employee: EmployeeProfileData;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [currentDailyRate, setCurrentDailyRate] = useState<number | null>(
    employee.dailyRate ?? null,
  );
  const [dailyRateInput, setDailyRateInput] = useState<string>(
    employee.dailyRate == null ? "" : String(employee.dailyRate),
  );
  const [dailyRateEffectiveFrom, setDailyRateEffectiveFrom] = useState<string>(
    getTodayDateInput(),
  );
  const [dailyRateReason, setDailyRateReason] = useState<string>("");
  const [isDailyRateEditorOpen, setIsDailyRateEditorOpen] =
    useState<boolean>(false);
  const [savingDailyRate, setSavingDailyRate] = useState<boolean>(false);
  const [dailyRateSaveError, setDailyRateSaveError] = useState<string | null>(
    null,
  );
  const [dailyRateSaveSuccess, setDailyRateSaveSuccess] = useState<string | null>(
    null,
  );
  const [governmentId, setGovernmentId] = useState<GovernmentIdRecord | null>(
    null
  );
  const [loadingGovId, setLoadingGovId] = useState<boolean>(true);
  const [govIdError, setGovIdError] = useState<string | null>(null);
  const [contribution, setContribution] = useState<{
    sssEe?: number;
    sssEr?: number;
    philHealthEe?: number;
    philHealthEr?: number;
    pagIbigEe?: number;
    pagIbigEr?: number;
    withholdingEe?: number;
    withholdingEr?: number;
  } | null>(null);
  const [loadingContribution, setLoadingContribution] = useState<boolean>(true);
  const [contributionError, setContributionError] = useState<string | null>(null);
  const [rateHistory, setRateHistory] = useState<EmployeeRateHistoryItem[]>([]);
  const [loadingRateHistory, setLoadingRateHistory] = useState<boolean>(true);
  const [rateHistoryError, setRateHistoryError] = useState<string | null>(null);
  const [rateHistoryWarning, setRateHistoryWarning] = useState<string | null>(
    null,
  );
  const [employeeViolations, setEmployeeViolations] = useState<ViolationRow[]>(
    [],
  );
  const [loadingEmployeeViolations, setLoadingEmployeeViolations] =
    useState<boolean>(true);
  const [employeeViolationsError, setEmployeeViolationsError] = useState<
    string | null
  >(null);
  const [violationStrikeProgress, setViolationStrikeProgress] = useState<
    ViolationStrikeProgressRow[]
  >([]);
  const [loadingViolationStrikeProgress, setLoadingViolationStrikeProgress] =
    useState<boolean>(true);
  const [violationStrikeProgressError, setViolationStrikeProgressError] =
    useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState<
    Pick<
      GovernmentIdRecord,
      "tinNumber" | "sssNumber" | "philHealthNumber" | "pagIbigNumber"
    >
  >({
    tinNumber: "",
    sssNumber: "",
    philHealthNumber: "",
    pagIbigNumber: "",
  });

  useEffect(() => {
    const fetchGovId = async () => {
      try {
        setLoadingGovId(true);
        const result = await getGovernmentIdByEmployee(employee.employeeId);
        if (!result.success) {
          setGovIdError(result.error || "Failed to load government IDs");
          return;
        }

        const record = result.data ?? null;
        setGovernmentId(record);
        setFormState({
          tinNumber: record?.tinNumber ?? "",
          sssNumber: record?.sssNumber ?? "",
          philHealthNumber: record?.philHealthNumber ?? "",
          pagIbigNumber: record?.pagIbigNumber ?? "",
        });
      } catch (error) {
        console.error("Error loading government IDs:", error);
        setGovIdError("Failed to load government IDs");
      } finally {
        setLoadingGovId(false);
      }
    };

    fetchGovId();
  }, [employee.employeeId]);

  useEffect(() => {
    setCurrentDailyRate(employee.dailyRate ?? null);
    setDailyRateInput(employee.dailyRate == null ? "" : String(employee.dailyRate));
    setDailyRateEffectiveFrom(getTodayDateInput());
    setDailyRateReason("");
    setIsDailyRateEditorOpen(false);
  }, [employee.employeeId, employee.dailyRate]);

  useEffect(() => {
    const fetchRateHistory = async () => {
      try {
        setLoadingRateHistory(true);
        setRateHistoryError(null);
        setRateHistoryWarning(null);
        const result = await getEmployeeRateHistory(employee.employeeId);
        if (!result.success) {
          throw new Error(result.error || "Failed to load rate history");
        }
        setRateHistory(result.data ?? []);
        setRateHistoryWarning(result.warning ?? null);
      } catch (error) {
        console.error("Error loading rate history:", error);
        setRateHistoryError("Failed to load rate history");
      } finally {
        setLoadingRateHistory(false);
      }
    };

    fetchRateHistory();
  }, [employee.employeeId]);

  useEffect(() => {
    // Load contribution so we can show EE/ER alongside IDs
    const fetchContribution = async () => {
      try {
        setLoadingContribution(true);
        setContributionError(null);
        const result = await getEmployeeContribution(employee.employeeId);
        if (!result.success) {
          throw new Error(result.error || "Failed to load contribution");
        }
        setContribution(result.data ?? null);
      } catch (error) {
        console.error("Error loading contribution:", error);
        setContributionError("Failed to load contribution");
      } finally {
        setLoadingContribution(false);
      }
    };
    fetchContribution();
  }, [employee.employeeId]);

  useEffect(() => {
    const fetchEmployeeViolations = async () => {
      try {
        setLoadingEmployeeViolations(true);
        setEmployeeViolationsError(null);
        const result = await getViolations({ employeeId: employee.employeeId });
        if (!result.success) {
          throw new Error(result.error || "Failed to load employee violations");
        }
        setEmployeeViolations(result.data ?? []);
      } catch (error) {
        console.error("Error loading employee violations:", error);
        setEmployeeViolationsError("Failed to load employee violations");
      } finally {
        setLoadingEmployeeViolations(false);
      }
    };

    fetchEmployeeViolations();
  }, [employee.employeeId]);

  useEffect(() => {
    const fetchViolationStrikeProgress = async () => {
      try {
        setLoadingViolationStrikeProgress(true);
        setViolationStrikeProgressError(null);
        const result = await getEmployeeViolationStrikeProgress({
          employeeId: employee.employeeId,
        });
        if (!result.success) {
          throw new Error(result.error || "Failed to load strike progress");
        }
        setViolationStrikeProgress(result.data ?? []);
      } catch (error) {
        console.error("Error loading violation strike progress:", error);
        setViolationStrikeProgressError("Failed to load strike progress");
      } finally {
        setLoadingViolationStrikeProgress(false);
      }
    };

    fetchViolationStrikeProgress();
  }, [employee.employeeId]);

  const handleSaveGovIds = async () => {
    try {
      setIsSaving(true);
      setGovIdError(null);
      const result = await upsertGovernmentId({
        employeeId: employee.employeeId,
        ...formState,
      });

      if (!result.success) {
        setGovIdError(result.error || "Failed to save government IDs");
        return;
      }

      setGovernmentId(result.data || null);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving government IDs:", error);
      setGovIdError("Failed to save government IDs");
    } finally {
      setIsSaving(false);
    }
  };

  const hasAnyGovId =
    !!governmentId?.tinNumber ||
    !!governmentId?.sssNumber ||
    !!governmentId?.philHealthNumber ||
    !!governmentId?.pagIbigNumber;

  const reloadRateHistory = async () => {
    try {
      setLoadingRateHistory(true);
      setRateHistoryError(null);
      setRateHistoryWarning(null);
      const result = await getEmployeeRateHistory(employee.employeeId);
      if (!result.success) {
        throw new Error(result.error || "Failed to load rate history");
      }
      setRateHistory(result.data ?? []);
      setRateHistoryWarning(result.warning ?? null);
    } catch (error) {
      console.error("Error loading rate history:", error);
      setRateHistoryError("Failed to load rate history");
    } finally {
      setLoadingRateHistory(false);
    }
  };

  const handleSaveDailyRate = async () => {
    const trimmed = dailyRateInput.trim();
    const parsed = trimmed === "" ? null : Number.parseFloat(trimmed);
    const effectiveFrom = dailyRateEffectiveFrom.trim();
    const normalizedReason = dailyRateReason.trim();

    if (!effectiveFrom) {
      setDailyRateSaveError("Effective date is required.");
      setDailyRateSaveSuccess(null);
      return;
    }

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setDailyRateSaveError("Daily rate must be a valid non-negative number.");
      setDailyRateSaveSuccess(null);
      return;
    }

    try {
      setSavingDailyRate(true);
      setDailyRateSaveError(null);
      setDailyRateSaveSuccess(null);
      const result = await updateEmployee({
        employeeId: employee.employeeId,
        dailyRate: parsed,
        rateEffectiveFrom: effectiveFrom,
        rateReason: normalizedReason === "" ? null : normalizedReason,
      } as Parameters<typeof updateEmployee>[0]);
      if (!result.success) {
        throw new Error(result.error || "Failed to update daily rate");
      }

      const savedRate = result.data?.dailyRate ?? null;
      setCurrentDailyRate(savedRate);
      setDailyRateInput(savedRate == null ? "" : String(savedRate));
      setDailyRateSaveSuccess(
        `Daily rate updated to ${formatRate(savedRate)} (effective ${new Date(
          `${effectiveFrom}T00:00:00`,
        ).toLocaleDateString()}).`,
      );
      setDailyRateReason("");
      await reloadRateHistory();
      router.refresh();
    } catch (error) {
      console.error("Failed to update daily rate:", error);
      setDailyRateSaveError(
        error instanceof Error ? error.message : "Failed to update daily rate",
      );
      setDailyRateSaveSuccess(null);
    } finally {
      setSavingDailyRate(false);
    }
  };

  const formatRate = (value: number | null | undefined) => {
    if (value == null) return "—";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(value);
  };

  const approvedViolationsCount = employeeViolations.filter(
    (violation) => violation.status === "APPROVED",
  ).length;
  const countedStrikesTotal = employeeViolations
    .filter((violation) => violation.isCountedForStrike)
    .reduce(
      (total, violation) => total + Math.max(0, violation.strikePointsSnapshot),
      0,
    );

  return (
    <div className="mt-6 rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap gap-2 border-b px-4 py-3">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
            aria-pressed={activeTab === tab.key}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === "profile" && (
          <EmployeeForm
            employeeId={employee.employeeId}
            mode="view"
            initialData={{
              ...employee,
              dailyRate: currentDailyRate,
            }}
          />
        )}

        {activeTab === "dailyRate" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Current Daily Rate</CardTitle>
                <CardDescription>
                  This is the active rate used as default for new computations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-semibold tracking-tight">
                  {formatRate(currentDailyRate)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Employee: {employee.employeeCode}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Edit Daily Rate</CardTitle>
                    <CardDescription>
                      Update the employee&apos;s base daily pay and save the reason.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isDailyRateEditorOpen ? "secondary" : "outline"}
                    onClick={() =>
                      setIsDailyRateEditorOpen((prevOpen) => !prevOpen)
                    }
                  >
                    {isDailyRateEditorOpen ? "Hide Editor" : "Edit Rate"}
                  </Button>
                </div>
              </CardHeader>
              {isDailyRateEditorOpen && (
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dailyRateTabInput">Daily Rate (PHP)</Label>
                      <Input
                        id="dailyRateTabInput"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={dailyRateInput}
                        onChange={(e) => setDailyRateInput(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dailyRateEffectiveFrom">
                        Effective From
                      </Label>
                      <Input
                        id="dailyRateEffectiveFrom"
                        type="date"
                        value={dailyRateEffectiveFrom}
                        onChange={(e) =>
                          setDailyRateEffectiveFrom(e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dailyRateReason">Reason (optional)</Label>
                    <textarea
                      id="dailyRateReason"
                      value={dailyRateReason}
                      onChange={(e) => setDailyRateReason(e.target.value)}
                      placeholder="Ex: Promotion increase, correction, or policy adjustment"
                      className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={handleSaveDailyRate}
                      disabled={savingDailyRate}
                      className="gap-2"
                      type="button"
                    >
                      {savingDailyRate && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      Save Rate
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsDailyRateEditorOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                  {dailyRateSaveSuccess && (
                    <p className="text-sm text-green-600">{dailyRateSaveSuccess}</p>
                  )}
                  {dailyRateSaveError && (
                    <p className="text-sm text-destructive">{dailyRateSaveError}</p>
                  )}
                </CardContent>
              )}
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rate History</CardTitle>
                <CardDescription>
                  Historical changes are append-only and ordered by effective date.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingRateHistory ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading rate history...
                  </div>
                ) : rateHistoryError ? (
                  <p className="text-sm text-destructive">{rateHistoryError}</p>
                ) : rateHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No rate history yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {rateHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border bg-background/60 px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {formatRate(entry.dailyRate)}
                          </p>
                          <Badge variant="outline">
                            {new Date(entry.effectiveFrom).toLocaleDateString()}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Effective:{" "}
                          {new Date(entry.effectiveFrom).toLocaleString()}
                        </p>
                        {entry.reason && (
                          <p className="text-xs text-muted-foreground">
                            Reason: {entry.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {rateHistoryWarning && (
                  <p className="text-xs text-amber-600">{rateHistoryWarning}</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "violations" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-dashed">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Total Records
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-2xl font-semibold">{employeeViolations.length}</p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Approved Records
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-2xl font-semibold">{approvedViolationsCount}</p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Counted Strikes
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-2xl font-semibold">{countedStrikesTotal}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Strike Progress Per Violation Type
                </CardTitle>
                <CardDescription>
                  Counted strikes after resets, shown against each type&apos;s cap.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingViolationStrikeProgress ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading strike progress...
                  </div>
                ) : violationStrikeProgressError ? (
                  <p className="text-sm text-destructive">
                    {violationStrikeProgressError}
                  </p>
                ) : violationStrikeProgress.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No committed violation types yet.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {violationStrikeProgress.map((item) => {
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
                            <p className="text-sm font-medium">
                              {item.violationName}
                            </p>
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

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Employee Violation History</CardTitle>
                <CardDescription>
                  Includes draft, approved, and rejected entries with strike-count status.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingEmployeeViolations ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading employee violations...
                  </div>
                ) : employeeViolationsError ? (
                  <p className="text-sm text-destructive">{employeeViolationsError}</p>
                ) : employeeViolations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No violation records found for this employee.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Violation</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Strike</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeViolations.map((violation) => (
                          <TableRow key={violation.id}>
                            <TableCell>
                              {new Date(violation.violationDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{violation.violationName}</p>
                              <p className="text-xs text-muted-foreground">
                                {violation.violationDescription || "No description"}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  violation.status === "APPROVED"
                                    ? "border-emerald-600 text-emerald-700"
                                    : violation.status === "REJECTED"
                                      ? "border-destructive text-destructive"
                                      : "border-orange-600 text-orange-700"
                                }
                              >
                                {violation.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {violation.isCountedForStrike
                                ? `${violation.strikePointsSnapshot} counted`
                                : "Not counted"}
                            </TableCell>
                            <TableCell className="max-w-[24rem]">
                              <p className="line-clamp-2 text-sm text-muted-foreground">
                                {violation.reviewRemarks ||
                                  violation.remarks ||
                                  "No remarks"}
                              </p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "govIds" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-1">
                <p className="text-lg font-semibold">Government IDs</p>
                <p className="text-sm text-muted-foreground">
                  Saved per employee. Shows &quot;Not set&quot; until you add them.
                </p>
              </div>
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" />
                    {hasAnyGovId ? "Edit IDs" : "Add IDs"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {hasAnyGovId ? "Update Government IDs" : "Add Government IDs"}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      Add or update government ID numbers for this employee.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {govIdFields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Input
                          id={field.key}
                          value={formState[field.key] ?? ""}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          placeholder={`Enter ${field.label}`}
                        />
                        <p className="text-xs text-muted-foreground">
                          {field.helper}
                        </p>
                      </div>
                    ))}
                  </div>
                  {govIdError && (
                    <p className="text-sm text-destructive">{govIdError}</p>
                  )}
                  <DialogFooter>
                    <Button
                      onClick={handleSaveGovIds}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      {isSaving && <Loader2 className="size-4 animate-spin" />}
                      Save IDs
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {govIdError && !isModalOpen && (
              <p className="text-sm text-destructive">{govIdError}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {govIdFields.map((item) => {
                const value = governmentId?.[item.key] ?? "";
                return (
                  <Card key={item.label} className="border-dashed">
                    <CardHeader className="gap-2 px-4 pt-4 pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{item.label}</CardTitle>
                        <Badge variant="outline">
                          {loadingGovId ? "Loading..." : value ? "Set" : "Not set"}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {item.helper}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2">
                      {loadingGovId ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          Loading ID...
                        </div>
                      ) : value ? (
                        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                          <IdCard className="size-4 text-muted-foreground" />
                          <p className="text-sm font-medium">{value}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                          <IdCard className="size-4 text-muted-foreground" />
                          <span>
                            Not set yet. Click &ldquo;{hasAnyGovId ? "Edit" : "Add"} IDs&rdquo; to
                            save it.
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Contributions (EE/ER)</p>
                {loadingContribution && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Loading...
                  </div>
                )}
              </div>
              {contributionError && (
                <p className="text-xs text-destructive">{contributionError}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["SSS", "sssEe", "sssEr"],
                  ["PhilHealth", "philHealthEe", "philHealthEr"],
                  ["Pag-IBIG", "pagIbigEe", "pagIbigEr"],
                  ["Tax", "withholdingEe", "withholdingEr"],
                ].map(([label, eeKey, erKey]) => (
                  <div key={label} className="rounded-lg border bg-background/60 px-3 py-3 shadow-xs">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-sm font-semibold">
                      EE:{" "}
                      {contribution && contribution[eeKey as keyof typeof contribution] != null
                        ? contribution[eeKey as keyof typeof contribution]
                        : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ER:{" "}
                      {contribution && contribution[erKey as keyof typeof contribution] != null
                        ? contribution[erKey as keyof typeof contribution]
                        : "—"}{" "}
                      (admin)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default EmployeeProfileTabs;
