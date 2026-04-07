"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getEmployeeContribution,
  upsertEmployeeContribution,
} from "@/actions/contributions/contributions-action";
import {
  getGovernmentIdByEmployee,
  type GovernmentIdRecord,
} from "@/actions/contributions/government-ids-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  buildContributionFormState,
  contributionEditorSections,
  contributionScheduleOptions,
  type ContributionFormState,
  payrollFrequencyOptions,
} from "@/features/manage-contributions/contribution-editor-shared";

type ContributionEditPageProps = {
  employeeId: string;
  returnPath: string;
};

export function ContributionEditPage({
  employeeId,
  returnPath,
}: ContributionEditPageProps) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<ContributionFormState>(
    buildContributionFormState()
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [governmentId, setGovernmentId] = useState<GovernmentIdRecord | null>(
    null
  );

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const result = await getEmployeeContribution(employeeId);
        if (!result.success) {
          throw new Error(result.error || "Failed to load contribution");
        }

        setForm(buildContributionFormState(result.data ?? null));

        const govResult = await getGovernmentIdByEmployee(employeeId);
        if (govResult.success) {
          setGovernmentId(govResult.data || null);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load contribution"
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [employeeId]);

  const updateNumberField = (
    field: keyof ContributionFormState,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value === "" ? 0 : Number(value) || 0,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = await upsertEmployeeContribution({
        employeeId,
        ...form,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to save contribution");
      }
      toast.success("Contribution saved successfully.");
      router.push(returnPath);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save contribution";
      setError(message);
      toast.error("Failed to save contribution.", {
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Contributions</h1>
          <p className="text-sm text-muted-foreground">
            Update contribution amounts, payroll cadence, currency, and
            auto-apply schedules for this employee.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={returnPath}>Back to directory</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Contribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-4">
              {governmentId && (
                <div className="grid gap-2 text-sm sm:grid-cols-4">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">TIN</div>
                    <div className="font-medium">
                      {governmentId.tinNumber || "Not set"}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">SSS</div>
                    <div className="font-medium">
                      {governmentId.sssNumber || "Not set"}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">
                      PhilHealth
                    </div>
                    <div className="font-medium">
                      {governmentId.philHealthNumber || "Not set"}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">
                      Pag-IBIG
                    </div>
                    <div className="font-medium">
                      {governmentId.pagIbigNumber || "Not set"}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee-contribution-payroll-frequency">
                    Payroll frequency
                  </Label>
                  <Select
                    value={form.payrollFrequency}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        payrollFrequency:
                          value as ContributionFormState["payrollFrequency"],
                      }))
                    }
                  >
                    <SelectTrigger
                      id="employee-contribution-payroll-frequency"
                      className="w-full"
                    >
                      <SelectValue placeholder="Select payroll frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {payrollFrequencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employee-contribution-currency">
                    Currency code
                  </Label>
                  <Input
                    id="employee-contribution-currency"
                    value={form.currencyCode}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        currencyCode: event.target.value
                          .toUpperCase()
                          .slice(0, 8),
                      }))
                    }
                    placeholder="PHP"
                    maxLength={8}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                This path now uses the same contribution schedule controls as
                the main contributions directory.
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {contributionEditorSections.map(
                  ({
                    label,
                    eeKey,
                    erKey,
                    activeKey,
                    scheduleKey,
                    governmentIdKey,
                  }) => (
                    <div
                      key={eeKey}
                      className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">
                          {label} Contribution
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {governmentId?.[governmentIdKey] || `No ${label}`}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            EE
                          </Label>
                          <Input
                            type="number"
                            value={form[eeKey] ?? 0}
                            onChange={(e) =>
                              updateNumberField(eeKey, e.target.value)
                            }
                            placeholder="EE"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            ER
                          </Label>
                          <Input
                            type="number"
                            value={form[erKey] ?? 0}
                            onChange={(e) =>
                              updateNumberField(erKey, e.target.value)
                            }
                            placeholder="ER"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Auto-apply schedule
                        </Label>
                        <Select
                          value={form[scheduleKey]}
                          onValueChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              [scheduleKey]:
                                value as ContributionFormState[typeof scheduleKey],
                            }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a schedule" />
                          </SelectTrigger>
                          <SelectContent>
                            {contributionScheduleOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-muted"
                          checked={form[activeKey] ?? true}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              [activeKey]: e.target.checked,
                            }))
                          }
                        />
                        Active in payroll calculations
                      </label>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push(returnPath)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="gap-2"
            >
              {saving && (
                <span className="h-3 w-3 animate-spin rounded-full border border-border border-t-transparent" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ContributionEditPage;
