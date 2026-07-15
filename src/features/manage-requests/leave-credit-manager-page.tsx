"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listEmployeeLeaveCreditLedger,
  listLeaveCreditPolicies,
  listLeaveCreditResetRuns,
  runLeaveCreditReset,
  updateLeaveCreditPolicy,
  type EmployeeLeaveCreditLedgerRow,
  type LeaveCreditPolicyRow,
  type LeaveCreditResetRunRow,
} from "@/actions/requests/requests-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModuleLoadingState } from "@/components/loading/loading-states";
import { useToast } from "@/components/ui/toast-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "./request-ui-helpers";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  return {
    value: String(month),
    label: new Date(`2026-${String(month).padStart(2, "0")}-01T12:00:00+08:00`)
      .toLocaleDateString(undefined, { month: "long" }),
  };
});

const monthDayLabel = (month: string, day: string) => {
  const parsedMonth = Math.max(1, Math.min(12, Number(month) || 1));
  const parsedDay = Math.max(1, Math.min(31, Number(day) || 1));
  return new Date(
    `2026-${String(parsedMonth).padStart(2, "0")}-${String(parsedDay).padStart(2, "0")}T12:00:00+08:00`,
  ).toLocaleDateString(undefined, { month: "long", day: "numeric" });
};

export default function LeaveCreditManagerPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<LeaveCreditPolicyRow[]>([]);
  const [runs, setRuns] = useState<LeaveCreditResetRunRow[]>([]);
  const [ledger, setLedger] = useState<EmployeeLeaveCreditLedgerRow[]>([]);
  const [policyDrafts, setPolicyDrafts] = useState<
    Record<string, { resetMonth: string; resetDay: string; annualCredits: string }>
  >({});
  const [runningResetFor, setRunningResetFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [policyResult, runResult, ledgerResult] = await Promise.all([
        listLeaveCreditPolicies(),
        listLeaveCreditResetRuns(),
        listEmployeeLeaveCreditLedger({ limit: 100 }),
      ]);

      if (!policyResult.success) {
        throw new Error(policyResult.error || "Failed to load leave credit policies.");
      }
      if (!runResult.success) {
        throw new Error(runResult.error || "Failed to load leave credit reset history.");
      }
      if (!ledgerResult.success) {
        throw new Error(ledgerResult.error || "Failed to load leave credit ledger.");
      }

      setPolicies(policyResult.data ?? []);
      setRuns(runResult.data ?? []);
      setLedger(ledgerResult.data ?? []);
      setPolicyDrafts(
        Object.fromEntries(
          (policyResult.data ?? []).map((row) => [
            row.leaveType,
            {
              resetMonth: String(row.resetMonth),
              resetDay: String(row.resetDay),
              annualCredits: String(row.annualCredits),
            },
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leave credit module.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePolicy = async (leaveType: "SICK" | "SIL") => {
    try {
      const draft = policyDrafts[leaveType];
      const result = await updateLeaveCreditPolicy({
        leaveType,
        resetMonth: Number(draft?.resetMonth ?? 1),
        resetDay: Number(draft?.resetDay ?? 1),
        annualCredits: Number(draft?.annualCredits ?? 5),
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to save leave credit policy.");
      }
      toast.success("Policy saved", {
        description: `${leaveType} policy updated.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save leave credit policy.");
    }
  };

  const triggerReset = async (leaveType: "SICK" | "SIL") => {
    try {
      setRunningResetFor(leaveType);
      const result = await runLeaveCreditReset({ leaveType });
      if (!result.success) {
        throw new Error(result.error || "Failed to run leave credit reset.");
      }
      toast.success("Reset run completed", {
        description: `${leaveType} credits were reset for the current cycle.`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run leave credit reset.");
    } finally {
      setRunningResetFor(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">Leave Credits</h1>
        <p className="text-sm text-muted-foreground">
          Manage paid leave credit policies, reset schedules, and credit history.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-4">
          <CardTitle>Leave Credit Settings</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
          {loading ? (
            <ModuleLoadingState
              title="Loading leave credits"
              description="Fetching credit policies, reset history, and ledger entries."
            />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {policies.map((policy) => {
                const draft = policyDrafts[policy.leaveType];
                return (
                  <Card key={policy.id} className="border-border/70 shadow-none">
                    <CardContent className="space-y-4 p-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {policy.leaveType === "SIL" ? "Service Incentive Leave" : "Sick Leave"}
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {policy.annualCredits} credit(s) per year
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Resets every {monthDayLabel(String(policy.resetMonth), String(policy.resetDay))}
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Reset month</Label>
                          <Select
                            value={draft?.resetMonth ?? ""}
                            onValueChange={(value) =>
                              setPolicyDrafts((current) => ({
                                ...current,
                                [policy.leaveType]: {
                                  ...current[policy.leaveType],
                                  resetMonth: value,
                                },
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                              {MONTH_OPTIONS.map((month) => (
                                <SelectItem key={month.value} value={month.value}>
                                  {month.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Reset day</Label>
                          <Input
                            type="number"
                            min="1"
                            max="31"
                            value={draft?.resetDay ?? ""}
                            onChange={(event) =>
                              setPolicyDrafts((current) => ({
                                ...current,
                                [policy.leaveType]: {
                                  ...current[policy.leaveType],
                                  resetDay: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Credits per year</Label>
                          <Input
                            type="number"
                            min="0"
                            value={draft?.annualCredits ?? ""}
                            onChange={(event) =>
                              setPolicyDrafts((current) => ({
                                ...current,
                                [policy.leaveType]: {
                                  ...current[policy.leaveType],
                                  annualCredits: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                        <p className="font-medium">
                          Preview: {draft?.annualCredits || 0} credit(s) reset every{" "}
                          {monthDayLabel(draft?.resetMonth ?? "1", draft?.resetDay ?? "1")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Month = when new yearly credits begin. Day = exact reset date.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => void savePolicy(policy.leaveType)}>
                          Save policy
                        </Button>
                        <Button
                          variant="outline"
                          disabled={runningResetFor === policy.leaveType}
                          onClick={() => void triggerReset(policy.leaveType)}
                        >
                          Run reset now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-4">
          <CardTitle>Reset History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-5 sm:px-6 sm:pb-6">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reset runs yet.</p>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="rounded-xl border border-border/70 p-4 text-sm">
                <p className="font-medium">
                  {run.leaveType} · {formatDate(run.effectiveDate)}
                </p>
                <p className="text-muted-foreground">
                  Cycle {formatDate(run.cycleStartDate)} to {formatDate(run.cycleEndDate)}
                </p>
                <p className="text-muted-foreground">
                  {run.employeeCount} employees · {run.annualCredits} credits · {run.runType}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-4">
          <CardTitle>Credit Ledger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-5 sm:px-6 sm:pb-6">
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave credit ledger entries yet.</p>
          ) : (
            ledger.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border/70 p-4 text-sm">
                <p className="font-medium">
                  {entry.employeeName} · {entry.leaveType} · {entry.entryType}
                </p>
                <p className="text-muted-foreground">
                  {formatDate(entry.effectiveDate)} · {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                </p>
                <p className="text-muted-foreground">
                  Balance {entry.balanceBefore} → {entry.balanceAfter}
                </p>
                {entry.notes ? (
                  <p className="text-muted-foreground">{entry.notes}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
