"use client";

import {
  getEmployeeContribution,
  upsertEmployeeContribution,
} from "@/actions/contributions/contributions-action";
import {
  getGovernmentIdByEmployee,
  type GovernmentIdRecord,
} from "@/actions/contributions/government-ids-action";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";

type ContributionForm = {
  sssEe: number;
  sssEr: number;
  isSssActive: boolean;
  philHealthEe: number;
  philHealthEr: number;
  isPhilHealthActive: boolean;
  pagIbigEe: number;
  pagIbigEr: number;
  isPagIbigActive: boolean;
  withholdingEe: number;
  withholdingEr: number;
  isWithholdingActive: boolean;
};

function emptyForm(): ContributionForm {
  return {
    sssEe: 0,
    sssEr: 0,
    isSssActive: true,
    philHealthEe: 0,
    philHealthEr: 0,
    isPhilHealthActive: true,
    pagIbigEe: 0,
    pagIbigEr: 0,
    isPagIbigActive: true,
    withholdingEe: 0,
    withholdingEr: 0,
    isWithholdingActive: true,
  };
}

export default function ContributionEditPage({
  params,
}: {
  params: { employeeId: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState<ContributionForm>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [governmentId, setGovernmentId] = useState<GovernmentIdRecord | null>(
    null
  );

  // Load existing contribution data for this employee
  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const result = await getEmployeeContribution(params.employeeId);
        if (!result.success) {
          throw new Error(result.error || "Failed to load contribution");
        }
        const c = result.data;
        setForm({
          sssEe: Number(c?.sssEe ?? 0),
          sssEr: Number(c?.sssEr ?? 0),
          isSssActive: c?.isSssActive ?? true,
          philHealthEe: Number(c?.philHealthEe ?? 0),
          philHealthEr: Number(c?.philHealthEr ?? 0),
          isPhilHealthActive: c?.isPhilHealthActive ?? true,
          pagIbigEe: Number(c?.pagIbigEe ?? 0),
          pagIbigEr: Number(c?.pagIbigEr ?? 0),
          isPagIbigActive: c?.isPagIbigActive ?? true,
          withholdingEe: Number(c?.withholdingEe ?? 0),
          withholdingEr: Number(c?.withholdingEr ?? 0),
          isWithholdingActive: c?.isWithholdingActive ?? true,
        });

        // Fetch government IDs to display alongside contributions
        const govResult = await getGovernmentIdByEmployee(params.employeeId);
        if (govResult.success) {
          setGovernmentId(govResult.data || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load contribution");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.employeeId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = await upsertEmployeeContribution({
        employeeId: params.employeeId,
        ...form,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to save contribution");
      }
      router.push("/admin/contributions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contribution");
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof ContributionForm, value: string) => {
    const num = Number(value);
    setForm((prev) => ({
      ...prev,
      // Use 0 for empty/invalid to avoid NaN payloads
      [key]: Number.isFinite(num) ? num : 0,
    }));
  };

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-12 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Contributions</h1>
          <p className="text-muted-foreground text-sm">
            Set EE/ER amounts for this employee. EE shows in directory; ER is kept for admin.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/contributions">Back to directory</Link>
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
            <div className="grid gap-4 sm:grid-cols-2">
              {governmentId && (
                <div className="sm:col-span-2 grid gap-2 sm:grid-cols-4 text-sm">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">TIN</div>
                    <div className="font-medium">{governmentId.tinNumber || "Not set"}</div>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">SSS</div>
                    <div className="font-medium">{governmentId.sssNumber || "Not set"}</div>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">PhilHealth</div>
                    <div className="font-medium">{governmentId.philHealthNumber || "Not set"}</div>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground">Pag-IBIG</div>
                    <div className="font-medium">{governmentId.pagIbigNumber || "Not set"}</div>
                  </div>
                </div>
              )}
              {[
                ["SSS", "sss", "isSssActive"],
              ["PhilHealth", "philHealth", "isPhilHealthActive"],
              ["Pag-IBIG", "pagIbig", "isPagIbigActive"],
              ["Tax", "withholding", "isWithholdingActive"],
            ].map(([label, key, activeKey]) => {
              const eeKey = `${key}Ee` as keyof ContributionForm;
              const erKey = `${key}Er` as keyof ContributionForm;
              const activeBool = form[activeKey as keyof ContributionForm] as boolean;
              const eeVal = form[eeKey] as number;
              const erVal = form[erKey] as number;
              return (
                <div key={key} className="space-y-2">
                  <div className="text-sm font-medium">{label} Contribution</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={eeVal ?? 0}
                      onChange={(e) => setField(eeKey, e.target.value)}
                      placeholder="EE"
                    />
                    <Input
                      type="number"
                      value={erVal ?? 0}
                      onChange={(e) => setField(erKey, e.target.value)}
                      placeholder="ER"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-muted"
                      checked={!!activeBool}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [activeKey as keyof ContributionForm]: e.target.checked,
                        }))
                      }
                    />
                    Active in payroll calculations
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    EE is shown to staff; ER is retained for admin reports. Toggle off to exclude this agency from payroll.
                  </p>
                </div>
              );
            })}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push("/admin/contributions")}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
              {saving && <span className="h-3 w-3 animate-spin rounded-full border border-border border-t-transparent" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
