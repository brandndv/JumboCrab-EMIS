"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import type { Employee as PrismaEmployee, GovernmentId } from "@prisma/client";
import { IdCard, Loader2, Plus } from "lucide-react";
import EmployeeForm from "./employee-form";

type TabKey = "profile" | "govIds" | "checklists" | "notes";

const tabs: { key: TabKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "govIds", label: "Government IDs" },
  { key: "checklists", label: "Onboarding" },
  { key: "notes", label: "Notes" },
];

const govIdFields: {
  key: keyof Pick<
    GovernmentId,
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

const onboardingChecklist = [
  "Collect IDs (TIN, SSS, PhilHealth, Pag-IBIG) once models exist.",
  "Gather bank details and preferred payout timing.",
  "Upload signed contract and job offer.",
  "Log emergency contact and approvers.",
];

export function EmployeeProfileTabs({
  employee,
}: {
  employee: PrismaEmployee;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [governmentId, setGovernmentId] = useState<GovernmentId | null>(null);
  const [loadingGovId, setLoadingGovId] = useState<boolean>(true);
  const [govIdError, setGovIdError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState<
    Pick<GovernmentId, "tinNumber" | "sssNumber" | "philHealthNumber" | "pagIbigNumber">
  >({
    tinNumber: "",
    sssNumber: "",
    philHealthNumber: "",
    pagIbigNumber: "",
  });
  const [localShares, setLocalShares] = useState<Record<string, string>>({
    tinNumber: "",
    sssNumber: "",
    philHealthNumber: "",
    pagIbigNumber: "",
  });

  const displayName = useMemo(() => {
    const parts = [employee.firstName, employee.lastName].filter(Boolean);
    return parts.length ? parts.join(" ") : "Employee";
  }, [employee.firstName, employee.lastName]);

  useEffect(() => {
    const fetchGovId = async () => {
      try {
        setLoadingGovId(true);
        const res = await fetch(
          `/api/government-ids/${employee.employeeId}`,
          {
            method: "GET",
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setGovIdError(data?.error || "Failed to load government IDs");
          return;
        }

        const data = await res.json();
        const record: GovernmentId | null = data?.data || null;
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

  const handleSaveGovIds = async () => {
    try {
      setIsSaving(true);
      setGovIdError(null);
      const res = await fetch(`/api/government-ids/${employee.employeeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGovIdError(data?.error || "Failed to save government IDs");
        return;
      }

      setGovernmentId(data?.data || null);
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
                const showShare = true;
                const shareValue = localShares[item.key] ?? "";

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
                      {showShare && (
                        <div className="space-y-1">
                          <Label className="text-xs">Employee Share (not saved)</Label>
                          <Input
                            value={shareValue}
                            onChange={(e) =>
                              setLocalShares((prev) => ({
                                ...prev,
                                [item.key]: e.target.value,
                              }))
                            }
                            placeholder="Enter employee share"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            UI-only for now; hook to DB when employee shares exist.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "checklists" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold">Onboarding</p>
              <p className="text-sm text-muted-foreground">
                Track what you need for {displayName}. This is UI-only for now.
              </p>
            </div>
            <Card className="border-dashed">
              <CardContent className="space-y-3 px-4 py-5">
                {onboardingChecklist.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/20 p-3"
                  >
                    <span className="mt-1 size-2 rounded-full bg-primary" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-5">{item}</p>
                      <p className="text-xs text-muted-foreground">
                        Add real data sources later (files, status toggles, dates).
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold">Notes</p>
              <p className="text-sm text-muted-foreground">
                Stub for future freeform notes, tags, and attachments.
              </p>
            </div>
            <Card className="border-dashed">
              <CardContent className="space-y-3 px-4 py-5">
                <div className="rounded-lg border bg-background p-3 shadow-inner">
                  <p className="text-sm font-medium">Draft note</p>
                  <p className="text-xs text-muted-foreground">
                    Keep upcoming notes here. Hook into persistence once the table
                    is created.
                  </p>
                  <Separator className="my-3" />
                  <textarea
                    rows={4}
                    className="w-full resize-none rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground"
                    placeholder="Notes will sync once the model exists."
                    disabled
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Idea: add activity timeline, approver comments, and attachments
                  tied to this employee.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeProfileTabs;
