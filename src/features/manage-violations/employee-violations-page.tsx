"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock,
  FileText,
  Send,
  type LucideIcon,
} from "lucide-react";
import {
  getEmployeeViolationStrikeProgress,
  getViolations,
  setEmployeeViolationAppealSubmitted,
  setEmployeeViolationAppealStep,
  setEmployeeViolationAcknowledged,
  type ViolationRow,
  type ViolationStrikeProgressRow,
} from "@/actions/violations/violations-action";
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
  InlineLoadingState,
  ModuleLoadingState,
  TableLoadingState,
} from "@/components/loading/loading-states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

const PAPER_STEPS = [
  {
    id: "secured",
    label: "Secure appeal paper from manager",
    description: "Ask manager for the official appeal form.",
    icon: ClipboardCheck,
  },
  {
    id: "filled",
    label: "Fill out appeal paper",
    description: "Complete the paper with your explanation and signature.",
    icon: FileText,
  },
  {
    id: "submitted",
    label: "Submit completed appeal paper to manager",
    description: "Hand the completed paper back to the manager.",
    icon: Send,
  },
] as const;

type PaperStepId = (typeof PAPER_STEPS)[number]["id"];
type AppealStepValue = "SECURED" | "FILLED" | "SUBMITTED_TO_MANAGER";

type FlowStepState = "done" | "active" | "locked";

type FlowStep = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  state: FlowStepState;
  checked?: boolean;
  disabled?: boolean;
  onToggle?: (checked: boolean) => void;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatStatus = (status: ViolationRow["status"]) => {
  if (status === "PENDING_EMPLOYEE") return "Needs employee action";
  if (status === "PENDING_MANAGER_REVIEW") return "Pending manager review";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Draft";
};

const statusClass = (status: ViolationRow["status"]) => {
  if (status === "APPROVED") return "border-emerald-600 text-emerald-700";
  if (status === "REJECTED") return "border-destructive text-destructive";
  if (status === "PENDING_MANAGER_REVIEW") return "border-blue-600 text-blue-700";
  return "border-orange-600 text-orange-700";
};

const stepRowClass = (state: FlowStepState) =>
  cn(
    "relative flex gap-3 rounded-lg border p-3 transition-colors",
    state === "done" &&
      "border-emerald-300 bg-emerald-50 text-foreground dark:border-emerald-800/80 dark:bg-emerald-950/25",
    state === "active" &&
      "border-primary/70 bg-primary/10 text-foreground shadow-sm dark:border-primary/60 dark:bg-primary/15",
    state === "locked" &&
      "border-border bg-background text-muted-foreground dark:bg-muted/10",
  );

const stepIconClass = (state: FlowStepState) =>
  cn(
    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border bg-background",
    state === "done" &&
      "border-emerald-600 bg-emerald-100 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300",
    state === "active" &&
      "border-primary bg-primary/10 text-primary dark:bg-primary/15",
    state === "locked" &&
      "border-muted-foreground/30 bg-muted/20 text-muted-foreground",
  );

const stepConnectorClass = (state: FlowStepState) =>
  cn(
    "absolute left-[1.875rem] top-12 h-[calc(100%-1.5rem)] w-px",
    state === "done"
      ? "bg-emerald-300 dark:bg-emerald-800"
      : "bg-border",
  );

const EmployeeViolationsPage = () => {
  const { employee, loading: sessionLoading } = useSession();
  const [rows, setRows] = useState<ViolationRow[]>([]);
  const [strikeProgress, setStrikeProgress] = useState<
    ViolationStrikeProgressRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [strikeLoading, setStrikeLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strikeError, setStrikeError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [appealSubmittingId, setAppealSubmittingId] = useState<string | null>(
    null,
  );
  const [savingAppealStep, setSavingAppealStep] = useState<string | null>(null);

  const load = async () => {
    if (!employee?.employeeId) {
      setRows([]);
      setStrikeProgress([]);
      setLoading(false);
      setStrikeLoading(false);
      return;
    }

    try {
      setLoading(true);
      setStrikeLoading(true);
      setError(null);
      setStrikeError(null);

      const [violationsResult, strikeResult] = await Promise.all([
        getViolations({ employeeId: employee.employeeId }),
        getEmployeeViolationStrikeProgress({ employeeId: employee.employeeId }),
      ]);

      if (!violationsResult.success) {
        setRows([]);
        setError(violationsResult.error || "Failed to load your violations");
      } else {
        setRows(violationsResult.data ?? []);
      }

      if (!strikeResult.success) {
        setStrikeProgress([]);
        setStrikeError(strikeResult.error || "Failed to load strike progress");
      } else {
        setStrikeProgress(strikeResult.data ?? []);
      }
    } catch (err) {
      setRows([]);
      setStrikeProgress([]);
      setError(
        err instanceof Error ? err.message : "Failed to load your violations",
      );
      setStrikeError(
        err instanceof Error ? err.message : "Failed to load strike progress",
      );
    } finally {
      setLoading(false);
      setStrikeLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, employee?.employeeId]);

  const actionRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.status === "PENDING_EMPLOYEE" &&
          !row.appealSubmittedAt,
      ),
    [rows],
  );
  const historyRows = useMemo(
    () => rows.filter((row) => !actionRows.some((item) => item.id === row.id)),
    [actionRows, rows],
  );
  const unacknowledgedCount = useMemo(
    () => rows.filter((row) => !row.isAcknowledged).length,
    [rows],
  );
  const pendingManagerCount = useMemo(
    () => rows.filter((row) => row.status === "PENDING_MANAGER_REVIEW").length,
    [rows],
  );
  const countedStrikesTotal = useMemo(
    () =>
      strikeProgress.reduce(
        (total, row) => total + row.currentCountedStrikes,
        0,
      ),
    [strikeProgress],
  );

  const isInitialPageLoading =
    sessionLoading ||
    (!error &&
      !strikeError &&
      rows.length === 0 &&
      strikeProgress.length === 0 &&
      (loading || strikeLoading));

  if (isInitialPageLoading) {
    return (
      <ModuleLoadingState
        title="My Violations"
        description="Loading your violation history and strike progress."
      />
    );
  }

  const updateRow = (updated: ViolationRow) => {
    setRows((previous) =>
      previous.map((row) => (row.id === updated.id ? updated : row)),
    );
  };

  const acknowledge = async (id: string) => {
    try {
      setAcknowledgingId(id);
      setError(null);
      const result = await setEmployeeViolationAcknowledged({
        id,
        isAcknowledged: true,
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to acknowledge violation");
      }
      updateRow(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to acknowledge violation",
      );
    } finally {
      setAcknowledgingId(null);
    }
  };

  const getPaperStepCompleted = (row: ViolationRow, stepId: PaperStepId) => {
    if (stepId === "secured") return Boolean(row.appealPaperSecuredAt);
    if (stepId === "filled") return Boolean(row.appealPaperFilledAt);
    return Boolean(row.appealPaperSubmittedToManagerAt);
  };

  const isPaperChecklistComplete = (row: ViolationRow) => {
    return PAPER_STEPS.every((step) => getPaperStepCompleted(row, step.id));
  };

  const toAppealStepValue = (stepId: PaperStepId): AppealStepValue => {
    if (stepId === "secured") return "SECURED";
    if (stepId === "filled") return "FILLED";
    return "SUBMITTED_TO_MANAGER";
  };

  const setChecklistValue = async (
    row: ViolationRow,
    stepId: PaperStepId,
    checked: boolean,
  ) => {
    try {
      const key = `${row.id}:${stepId}`;
      setSavingAppealStep(key);
      setError(null);
      const result = await setEmployeeViolationAppealStep({
        id: row.id,
        step: toAppealStepValue(stepId),
        completed: checked,
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to update appeal paper step");
      }
      updateRow(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update appeal paper step",
      );
    } finally {
      setSavingAppealStep(null);
    }
  };

  const submitAppealPaper = async (id: string) => {
    try {
      setAppealSubmittingId(id);
      setError(null);
      const result = await setEmployeeViolationAppealSubmitted({ id });
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to mark appeal paper submitted");
      }
      updateRow(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark appeal paper submitted",
      );
    } finally {
      setAppealSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">My Violations</h1>
        <p className="text-sm text-muted-foreground">
          Acknowledge pending violations, complete appeal paper steps, then
          submit for manager review.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Needs Action
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{actionRows.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Manager Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{pendingManagerCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unacknowledged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{unacknowledgedCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Counted Strikes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{countedStrikesTotal}</p>
          </CardContent>
        </Card>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Needs Your Action</CardTitle>
            <CardDescription>
              Complete each paper step before marking appeal paper submitted.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <InlineLoadingState
              label="Loading pending violations"
              lines={4}
              className="border-border/60 bg-muted/10"
            />
          ) : null}
          {!loading && actionRows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No violations need your action right now.
            </p>
          ) : null}
          {!loading &&
            actionRows.map((row) => {
              const canToggleStep = (stepId: PaperStepId) => {
                if (!row.isAcknowledged) return false;
                if (stepId === "secured") return true;
                if (stepId === "filled") {
                  return Boolean(row.appealPaperSecuredAt);
                }
                return Boolean(
                  row.appealPaperSecuredAt && row.appealPaperFilledAt,
                );
              };
              const paperComplete = isPaperChecklistComplete(row);
              const canSubmit = row.isAcknowledged && paperComplete;
              const completedSteps =
                1 +
                (row.isAcknowledged ? 1 : 0) +
                PAPER_STEPS.filter((step) =>
                  getPaperStepCompleted(row, step.id),
                ).length;
              const activePaperStep =
                PAPER_STEPS.find(
                  (step) =>
                    canToggleStep(step.id) &&
                    !getPaperStepCompleted(row, step.id),
                )?.id ?? null;
              const flowSteps: FlowStep[] = [
                {
                  id: "review",
                  title: "Review violation details",
                  description: "Read the violation type, date, and remarks.",
                  icon: FileText,
                  state: "done",
                },
                {
                  id: "acknowledge",
                  title: "Acknowledge violation",
                  description: row.isAcknowledged
                    ? "Acknowledgement recorded."
                    : "Confirm that you received this violation record.",
                  icon: row.isAcknowledged ? CheckCircle2 : Clock,
                  state: row.isAcknowledged ? "done" : "active",
                },
                ...PAPER_STEPS.map((step) => {
                  const unlocked = canToggleStep(step.id);
                  const checked = getPaperStepCompleted(row, step.id);
                  return {
                    id: step.id,
                    title: step.label,
                    description: step.description,
                    icon: step.icon,
                    state: checked
                      ? "done"
                      : activePaperStep === step.id
                        ? "active"
                        : "locked",
                    checked,
                    disabled: !unlocked,
                    onToggle: (checkedValue: boolean) =>
                      void setChecklistValue(row, step.id, checkedValue),
                  } satisfies FlowStep;
                }),
                {
                  id: "submit",
                  title: "Mark appeal paper submitted",
                  description: canSubmit
                    ? "All paper steps are complete. Send to manager review."
                    : "Complete the paper steps before submitting.",
                  icon: Send,
                  state: canSubmit ? "active" : "locked",
                },
              ];

              return (
                <div
                  key={row.id}
                  className="overflow-hidden rounded-lg border bg-background"
                >
                  <div className="grid gap-0 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.35fr)]">
                    <section className="border-b bg-muted/20 p-5 lg:border-b-0 lg:border-r">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-lg font-semibold">
                                {row.violationName}
                              </h2>
                              <Badge
                                variant="outline"
                                className={statusClass(row.status)}
                              >
                                {formatStatus(row.status)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Date: {formatDate(row.violationDate)}
                            </p>
                          </div>
                          {row.isAcknowledged ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-600 text-emerald-700"
                            >
                              Acknowledged
                            </Badge>
                          ) : null}
                        </div>

                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-xs font-medium uppercase text-muted-foreground">
                            Remarks
                          </p>
                          <p className="mt-1 text-sm">
                            {row.remarks ||
                              row.violationDescription ||
                              "No remarks"}
                          </p>
                        </div>

                        <div className="rounded-lg border bg-background p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium uppercase text-muted-foreground">
                                Appeal Progress
                              </p>
                              <p className="mt-1 text-sm font-medium">
                                {completedSteps} of 6 steps complete
                              </p>
                            </div>
                            <div className="flex size-12 items-center justify-center rounded-full border bg-muted/30 text-sm font-semibold">
                              {completedSteps}/6
                            </div>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary transition-all"
                              style={{
                                width: `${Math.round((completedSteps / 6) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4 p-5">
                      <div className="space-y-3">
                        {flowSteps.map((step, index) => {
                          const Icon =
                            step.state === "done"
                              ? CheckCircle2
                              : step.state === "active"
                                ? step.icon
                                : Circle;
                          const isPaperStep = Boolean(step.onToggle);

                          return (
                            <div key={step.id} className="relative">
                              {index < flowSteps.length - 1 ? (
                                <span
                                  aria-hidden="true"
                                  className={stepConnectorClass(step.state)}
                                />
                              ) : null}
                              <div className={stepRowClass(step.state)}>
                                <span className={stepIconClass(step.state)}>
                                  <Icon className="size-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p
                                        className={cn(
                                          "text-sm font-medium",
                                          step.state === "done" &&
                                            "text-emerald-900 dark:text-emerald-100",
                                        )}
                                      >
                                        {step.title}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {step.description}
                                      </p>
                                    </div>

                                    {step.id === "acknowledge" &&
                                    !row.isAcknowledged ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => void acknowledge(row.id)}
                                        disabled={acknowledgingId === row.id}
                                      >
                                        Acknowledge Violation
                                      </Button>
                                    ) : null}

                                    {isPaperStep ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={
                                          step.state === "active"
                                            ? "default"
                                            : "outline"
                                        }
                                        className={cn(
                                          step.checked &&
                                            "border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/40",
                                        )}
                                        disabled={
                                          step.disabled ||
                                          savingAppealStep ===
                                            `${row.id}:${step.id}`
                                        }
                                        onClick={() =>
                                          step.onToggle?.(!step.checked)
                                        }
                                      >
                                        {savingAppealStep ===
                                        `${row.id}:${step.id}`
                                          ? "Saving..."
                                          : step.checked
                                            ? "Done"
                                            : "Mark Done"}
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          Manager reviews the physical appeal paper after this
                          is sent to review.
                        </p>
                        <Button
                          type="button"
                          variant={canSubmit ? "default" : "outline"}
                          onClick={() => void submitAppealPaper(row.id)}
                          disabled={!canSubmit || appealSubmittingId === row.id}
                        >
                          {appealSubmittingId === row.id
                            ? "Submitting..."
                            : canSubmit
                              ? "Send to Manager Review"
                              : "Complete Paper Steps First"}
                        </Button>
                      </div>
                    </section>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Strike Progress</CardTitle>
          <CardDescription>
            Current counted strikes per violation type against the allowed cap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {strikeLoading ? (
            <InlineLoadingState
              label="Loading strike progress"
              lines={2}
              className="border-border/60 bg-muted/10"
            />
          ) : strikeError ? (
            <p className="text-sm text-destructive">{strikeError}</p>
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
                  <div
                    key={item.violationId}
                    className="rounded-lg border bg-background/60 p-3"
                  >
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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Violation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Violation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Strike Points</TableHead>
                  <TableHead>Acknowledgement</TableHead>
                  <TableHead>Appeal Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-3">
                      <TableLoadingState
                        label="Loading your violations"
                        columns={6}
                        rows={3}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading && historyRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No violation history found.
                    </TableCell>
                  </TableRow>
                ) : null}
                {!loading &&
                  historyRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.violationDate)}</TableCell>
                      <TableCell>
                        <p className="font-medium">{row.violationName}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.remarks || "No remarks"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(row.status)}>
                          {formatStatus(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.strikePointsSnapshot}</TableCell>
                      <TableCell>
                        {row.isAcknowledged ? (
                          <div className="text-xs text-emerald-700">
                            <p className="font-medium">Acknowledged</p>
                            {row.acknowledgedAt ? (
                              <p>{formatDateTime(row.acknowledgedAt)}</p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.appealSubmittedAt ? (
                          <div className="text-xs text-emerald-700">
                            <p className="font-medium">Submitted</p>
                            <p>{formatDateTime(row.appealSubmittedAt)}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not submitted</span>
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
};

export default EmployeeViolationsPage;
