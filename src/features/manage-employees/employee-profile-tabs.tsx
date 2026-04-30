"use client";

import { getEmployeeContribution } from "@/actions/contributions/contributions-action";
import {
  getGovernmentIdByEmployee,
  upsertGovernmentId,
  type GovernmentIdRecord,
} from "@/actions/contributions/government-ids-action";
import {
  getEmployeeCompensationHistory,
  getEmployeePositionHistory,
  type EmployeeActionRecord,
  type EmployeeCompensationHistoryItem,
  type EmployeePositionHistoryItem,
} from "@/actions/employees/employees-action";
import {
} from "@/actions/violations/violations-action";
import { useEffect, useState } from "react";
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
import { InlineLoadingState } from "@/components/loading/loading-states";
import { useToast } from "@/components/ui/toast-provider";
import { IdCard, Loader2, Plus } from "lucide-react";
import EmployeeForm from "./employee-form";
import { EmployeeFaceEnrollmentCard } from "./employee-face-enrollment-card";

type EmployeeProfileData = EmployeeActionRecord;

type TabKey =
  | "profile"
  | "face"
  | "compensation"
  | "govIds";

const tabs: { key: TabKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "face", label: "Face ID" },
  { key: "compensation", label: "Compensation" },
  { key: "govIds", label: "Government IDs" },
];

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
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [governmentId, setGovernmentId] = useState<GovernmentIdRecord | null>(
    null
  );
  const [loadingGovId, setLoadingGovId] = useState<boolean>(false);
  const [govIdError, setGovIdError] = useState<string | null>(null);
  const [contributionPreview, setContributionPreview] = useState<Awaited<
    ReturnType<typeof getEmployeeContribution>
  >["data"] | null>(null);
  const [loadingContribution, setLoadingContribution] = useState<boolean>(false);
  const [contributionError, setContributionError] = useState<string | null>(null);
  const [positionHistory, setPositionHistory] = useState<
    EmployeePositionHistoryItem[]
  >([]);
  const [loadingPositionHistory, setLoadingPositionHistory] =
    useState<boolean>(false);
  const [positionHistoryError, setPositionHistoryError] = useState<string | null>(
    null,
  );
  const [compensationHistory, setCompensationHistory] = useState<
    EmployeeCompensationHistoryItem[]
  >([]);
  const [loadingCompensationHistory, setLoadingCompensationHistory] =
    useState<boolean>(false);
  const [compensationHistoryError, setCompensationHistoryError] =
    useState<string | null>(null);
  const [hasLoadedGovId, setHasLoadedGovId] = useState(false);
  const [hasLoadedContribution, setHasLoadedContribution] = useState(false);
  const [hasLoadedPositionHistory, setHasLoadedPositionHistory] = useState(false);
  const [hasLoadedCompensationHistory, setHasLoadedCompensationHistory] =
    useState(false);
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
    if (activeTab !== "govIds" || hasLoadedGovId) {
      return;
    }

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
        setHasLoadedGovId(true);
      }
    };

    void fetchGovId();
  }, [activeTab, employee.employeeId, hasLoadedGovId]);

  useEffect(() => {
    if (activeTab !== "compensation" || hasLoadedPositionHistory) {
      return;
    }

    const fetchPositionHistory = async () => {
      try {
        setLoadingPositionHistory(true);
        setPositionHistoryError(null);
        const result = await getEmployeePositionHistory(employee.employeeId);
        if (!result.success) {
          throw new Error(result.error || "Failed to load position history");
        }
        setPositionHistory(result.data ?? []);
      } catch (error) {
        console.error("Error loading position history:", error);
        setPositionHistoryError("Failed to load position history");
      } finally {
        setLoadingPositionHistory(false);
        setHasLoadedPositionHistory(true);
      }
    };

    void fetchPositionHistory();
  }, [activeTab, employee.employeeId, hasLoadedPositionHistory]);

  useEffect(() => {
    if (activeTab !== "compensation" || hasLoadedCompensationHistory) {
      return;
    }

    const fetchCompensationHistory = async () => {
      try {
        setLoadingCompensationHistory(true);
        setCompensationHistoryError(null);
        const result = await getEmployeeCompensationHistory(employee.employeeId);
        if (!result.success) {
          throw new Error(result.error || "Failed to load compensation history");
        }
        setCompensationHistory(result.data ?? []);
      } catch (error) {
        console.error("Error loading compensation history:", error);
        setCompensationHistoryError("Failed to load compensation history");
      } finally {
        setLoadingCompensationHistory(false);
        setHasLoadedCompensationHistory(true);
      }
    };

    void fetchCompensationHistory();
  }, [activeTab, employee.employeeId, hasLoadedCompensationHistory]);

  useEffect(() => {
    if (activeTab !== "govIds" || hasLoadedContribution) {
      return;
    }

    const fetchContribution = async () => {
      try {
        setLoadingContribution(true);
        setContributionError(null);
        const result = await getEmployeeContribution({
          employeeId: employee.employeeId,
        });
        if (!result.success) {
          throw new Error(result.error || "Failed to load contribution preview");
        }
        setContributionPreview(result.data ?? null);
      } catch (error) {
        console.error("Error loading contribution preview:", error);
        setContributionError("Failed to load contribution preview");
      } finally {
        setLoadingContribution(false);
        setHasLoadedContribution(true);
      }
    };
    void fetchContribution();
  }, [activeTab, employee.employeeId, hasLoadedContribution]);

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
      toast.success("Government IDs saved successfully.");
    } catch (error) {
      console.error("Error saving government IDs:", error);
      const message =
        error instanceof Error ? error.message : "Failed to save government IDs";
      setGovIdError(message);
      toast.error("Failed to save government IDs.", {
        description: message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasAnyGovId =
    !!governmentId?.tinNumber ||
    !!governmentId?.sssNumber ||
    !!governmentId?.philHealthNumber ||
    !!governmentId?.pagIbigNumber;

  const formatRate = (value: number | null | undefined) => {
    if (value == null) return "—";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(value);
  };

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
            initialData={employee}
          />
        )}

        {activeTab === "compensation" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-dashed">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Current Position
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-lg font-semibold">
                    {employee.position || "Not assigned"}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Daily Rate
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-lg font-semibold">
                    {formatRate(employee.dailyRate)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Monthly Rate
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-lg font-semibold">
                    {formatRate(employee.monthlyRate)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Position History</CardTitle>
                <CardDescription>
                  Effective-dated position assignments for this employee.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingPositionHistory ? (
                  <InlineLoadingState
                    label="Loading position history"
                    lines={2}
                    className="border-border/60 bg-muted/10"
                  />
                ) : positionHistoryError ? (
                  <p className="text-sm text-destructive">
                    {positionHistoryError}
                  </p>
                ) : positionHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No position history yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {positionHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border bg-background/60 px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {entry.positionName || "Unassigned position"}
                          </p>
                          <Badge variant="outline">
                            {new Date(entry.effectiveFrom).toLocaleDateString()}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Department: {entry.departmentName || "Unassigned"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Effective to:{" "}
                          {entry.effectiveTo
                            ? new Date(entry.effectiveTo).toLocaleDateString()
                            : "Current"}
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Compensation History</CardTitle>
                <CardDescription>
                  Position-owned rate history linked to this employee&apos;s assignments.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingCompensationHistory ? (
                  <InlineLoadingState
                    label="Loading compensation history"
                    lines={2}
                    className="border-border/60 bg-muted/10"
                  />
                ) : compensationHistoryError ? (
                  <p className="text-sm text-destructive">
                    {compensationHistoryError}
                  </p>
                ) : compensationHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No compensation history yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {compensationHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border bg-background/60 px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {entry.positionName}
                          </p>
                          <Badge variant="outline">
                            {new Date(entry.effectiveFrom).toLocaleDateString()}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Daily {formatRate(entry.dailyRate)} • Monthly{" "}
                          {formatRate(entry.monthlyRate)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Effective to:{" "}
                          {entry.effectiveTo
                            ? new Date(entry.effectiveTo).toLocaleDateString()
                            : "Current"}
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
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "face" && (
          <div className="space-y-4">
            <EmployeeFaceEnrollmentCard employeeId={employee.employeeId} />
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

            {loadingGovId ? (
              <InlineLoadingState
                label="Loading government IDs"
                lines={3}
                className="border-border/60 bg-muted/10"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {govIdFields.map((item) => {
                  const value = governmentId?.[item.key] ?? "";
                  return (
                    <Card key={item.label} className="border-dashed">
                      <CardHeader className="gap-2 px-4 pt-4 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">{item.label}</CardTitle>
                          <Badge variant="outline">{value ? "Set" : "Not set"}</Badge>
                        </div>
                        <CardDescription className="text-xs">
                          {item.helper}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 px-4 pb-4">
                        {value ? (
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
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  Contribution Preview (EE/ER)
                </p>
                {loadingContribution ? <Badge variant="outline">Syncing</Badge> : null}
              </div>
              {contributionError && (
                <p className="text-xs text-destructive">{contributionError}</p>
              )}
              {loadingContribution ? (
                <InlineLoadingState
                  label="Loading contributions"
                  lines={2}
                  className="border-border/60 bg-muted/10"
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {contributionPreview
                    ? [
                        contributionPreview.sss,
                        contributionPreview.philHealth,
                        contributionPreview.pagIbig,
                        contributionPreview.withholding,
                      ].map((line) => (
                    <div
                      key={line.contributionType}
                      className="rounded-lg border bg-background/60 px-3 py-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {line.contributionType === "PHILHEALTH"
                            ? "PhilHealth"
                            : line.contributionType === "PAGIBIG"
                              ? "Pag-IBIG"
                              : line.contributionType === "WITHHOLDING"
                                ? "Tax"
                                : "SSS"}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{line.status}</Badge>
                          <Badge
                            variant={
                              line.isIncludedInPayroll ? "success" : "secondary"
                            }
                          >
                            {line.isIncludedInPayroll ? "In payroll" : "Excluded"}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">
                        EE: {formatRate(line.employeeShare)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ER: {formatRate(line.employerShare)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {line.governmentNumber || "Not set"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Range: {line.bracketRangeLabel || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Bracket: {line.bracketReference || line.bracketId || "—"}
                      </div>
                    </div>
                      ))
                    : (
                        <p className="text-sm text-muted-foreground">
                          No contribution preview available.
                        </p>
                      )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default EmployeeProfileTabs;
