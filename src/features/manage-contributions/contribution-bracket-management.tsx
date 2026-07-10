"use client";

import {
  adjustContributionBracketRow,
  getContributionBracketVersion,
  listContributionBracketVersions,
  replaceContributionBracketSchedule,
  type AdjustContributionBracketRowInput,
  type ContributionBracketViewRow,
  type ContributionBracketViewSection,
  type ContributionBracketVersionDetail,
  type ContributionBracketVersionSummary,
  type ReplaceContributionBracketScheduleInput,
} from "@/actions/contributions/contributions-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ContributionBracketSidebar from "@/features/manage-contributions/contribution-bracket-sidebar";
import type { ContributionType, PayrollFrequency } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";

type RowFormState = {
  lowerBound: string;
  upperBound: string;
  employeeFixedAmount: string;
  employerFixedAmount: string;
  employeeRate: string;
  employerRate: string;
  baseTax: string;
  marginalRate: string;
};

type EditingRowState = {
  section: ContributionBracketViewSection;
  row: ContributionBracketViewRow;
  values: RowFormState;
  effectiveFrom: string;
  referenceCode: string;
  changeReason: string;
};

type Props = {
  sections: ContributionBracketViewSection[];
  loading?: boolean;
  canManage: boolean;
  onChanged?: () => void;
};

const CONTRIBUTION_TYPES = [
  "SSS",
  "PHILHEALTH",
  "PAGIBIG",
  "WITHHOLDING",
] as ContributionType[];

const PAYROLL_FREQUENCIES = [
  "WEEKLY",
  "BIMONTHLY",
  "MONTHLY",
] as PayrollFrequency[];

const emptyRowForm: RowFormState = {
  lowerBound: "",
  upperBound: "",
  employeeFixedAmount: "",
  employerFixedAmount: "",
  employeeRate: "",
  employerRate: "",
  baseTax: "",
  marginalRate: "",
};

const toInputDateTime = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-PH") : "Open";

const formatCurrency = (value: number | null) =>
  value == null
    ? ""
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
      }).format(value);

const numericString = (value: number | null) => (value == null ? "" : String(value));

const rowToForm = (row: ContributionBracketViewRow): RowFormState => ({
  lowerBound: numericString(row.lowerBound),
  upperBound: numericString(row.upperBound),
  employeeFixedAmount: numericString(row.employeeFixedAmount),
  employerFixedAmount: numericString(row.employerFixedAmount),
  employeeRate: numericString(row.employeeRate),
  employerRate: numericString(row.employerRate),
  baseTax: numericString(row.baseTax),
  marginalRate: numericString(row.marginalRate),
});

const formToPayloadRow = (values: RowFormState) => ({
  lowerBound: values.lowerBound,
  upperBound: values.upperBound || null,
  employeeFixedAmount: values.employeeFixedAmount || null,
  employerFixedAmount: values.employerFixedAmount || null,
  employeeRate: values.employeeRate || null,
  employerRate: values.employerRate || null,
  baseTax: values.baseTax || null,
  marginalRate: values.marginalRate || null,
});

const sectionToRows = (section?: ContributionBracketViewSection) =>
  section?.rows.map(rowToForm) ?? [{ ...emptyRowForm }];

const rowFieldsForType = (
  contributionType: ContributionType,
): Array<keyof RowFormState> => {
  if (contributionType === "SSS") {
    return [
      "lowerBound",
      "upperBound",
      "employeeFixedAmount",
      "employerFixedAmount",
    ];
  }
  if (contributionType === "WITHHOLDING") {
    return ["lowerBound", "upperBound", "baseTax", "marginalRate"];
  }
  return ["lowerBound", "upperBound", "employeeRate", "employerRate"];
};

const FIELD_LABELS: Record<keyof RowFormState, string> = {
  lowerBound: "Lower",
  upperBound: "Upper",
  employeeFixedAmount: "EE Fixed",
  employerFixedAmount: "ER Fixed",
  employeeRate: "EE Rate",
  employerRate: "ER Rate",
  baseTax: "Base Tax",
  marginalRate: "Marginal Rate",
};

export default function ContributionBracketManagement({
  sections,
  loading,
  canManage,
  onChanged,
}: Props) {
  const [activeTab, setActiveTab] = useState<"active" | "history" | "detail">(
    "active",
  );
  const [versions, setVersions] = useState<ContributionBracketVersionSummary[]>(
    [],
  );
  const [detail, setDetail] = useState<ContributionBracketVersionDetail | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [replaceType, setReplaceType] = useState<ContributionType>("SSS");
  const [replaceFrequency, setReplaceFrequency] =
    useState<PayrollFrequency>("MONTHLY");
  const [replaceEffectiveFrom, setReplaceEffectiveFrom] = useState(
    toInputDateTime(),
  );
  const [replaceReferenceCode, setReplaceReferenceCode] = useState("");
  const [replaceReason, setReplaceReason] = useState("");
  const [scheduleRows, setScheduleRows] = useState<RowFormState[]>([
    { ...emptyRowForm },
  ]);
  const [editingRow, setEditingRow] = useState<EditingRowState | null>(null);

  const selectedSection = useMemo(
    () =>
      sections.find((section) => section.contributionType === replaceType),
    [replaceType, sections],
  );

  useEffect(() => {
    setScheduleRows(sectionToRows(selectedSection));
  }, [selectedSection]);

  const visibleScheduleFields = rowFieldsForType(replaceType);

  const updateScheduleRow = (
    rowIndex: number,
    field: keyof RowFormState,
    value: string,
  ) => {
    setScheduleRows((current) =>
      current.map((row, index) =>
        index === rowIndex ? { ...row, [field]: value } : row,
      ),
    );
  };

  const loadVersions = useCallback(async () => {
    setLoadingVersions(true);
    const result = await listContributionBracketVersions();
    if (result.success) {
      setVersions(result.data ?? []);
    } else {
      setMessage(result.error ?? "Failed to load versions.");
    }
    setLoadingVersions(false);
  }, []);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const loadDetail = async (versionId: string) => {
    const result = await getContributionBracketVersion(versionId);
    if (result.success) {
      setDetail(result.data ?? null);
      setActiveTab("detail");
    } else {
      setMessage(result.error ?? "Failed to load version detail.");
    }
  };

  const refreshAll = async () => {
    await loadVersions();
    onChanged?.();
  };

  const handleUpdateContribution = async () => {
    if (!canManage || saving) return;
    const confirmed = window.confirm(
      "Payroll generated after the effective date will use this new bracket version.",
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage(null);
    const input: ReplaceContributionBracketScheduleInput = {
      contributionType: replaceType,
      payrollFrequency:
        replaceType === "WITHHOLDING" ? replaceFrequency : null,
      effectiveFrom: replaceEffectiveFrom,
      referenceCode: replaceReferenceCode,
      changeReason: replaceReason,
      rows: scheduleRows.map(formToPayloadRow),
    };
    const result = await replaceContributionBracketSchedule(input);
    setSaving(false);

    if (!result.success) {
      setMessage(result.error ?? "Failed to update contribution.");
      return;
    }

    setMessage("Contribution bracket version updated.");
    await refreshAll();
  };

  const handleAdjustRow = async () => {
    if (!editingRow?.row.versionId || !canManage || saving) return;
    const confirmed = window.confirm(
      "This will clone the active schedule, adjust this row, and create a new version.",
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage(null);
    const input: AdjustContributionBracketRowInput = {
      versionId: editingRow.row.versionId,
      rowId: editingRow.row.id,
      effectiveFrom: editingRow.effectiveFrom,
      referenceCode: editingRow.referenceCode,
      changeReason: editingRow.changeReason,
      row: formToPayloadRow(editingRow.values),
    };
    const result = await adjustContributionBracketRow(input);
    setSaving(false);

    if (!result.success) {
      setMessage(result.error ?? "Failed to adjust row.");
      return;
    }

    setEditingRow(null);
    setMessage("Adjusted row saved as a new bracket version.");
    await refreshAll();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={activeTab === "active" ? "default" : "outline"}
          onClick={() => setActiveTab("active")}
        >
          Active Brackets
        </Button>
        <Button
          type="button"
          variant={activeTab === "history" ? "default" : "outline"}
          onClick={() => setActiveTab("history")}
        >
          Version History
        </Button>
        <Button
          type="button"
          variant={activeTab === "detail" ? "default" : "outline"}
          disabled={!detail}
          onClick={() => setActiveTab("detail")}
        >
          Version Detail
        </Button>
      </div>

      {message ? (
        <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      {activeTab === "active" ? (
        <div className="space-y-4">
          {canManage ? (
            <Card className="border-border/70 bg-card/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Update Contribution Bracket Schedule
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Creates a new effective version. Existing rows are closed,
                  not overwritten.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-5">
                  <select
                    value={replaceType}
                    onChange={(event) =>
                      setReplaceType(event.target.value as ContributionType)
                    }
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    {CONTRIBUTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <select
                    value={replaceFrequency}
                    disabled={replaceType !== "WITHHOLDING"}
                    onChange={(event) =>
                      setReplaceFrequency(event.target.value as PayrollFrequency)
                    }
                    className="h-10 rounded-md border bg-background px-3 text-sm disabled:opacity-50"
                  >
                    {PAYROLL_FREQUENCIES.map((frequency) => (
                      <option key={frequency} value={frequency}>
                        {frequency}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="datetime-local"
                    value={replaceEffectiveFrom}
                    onChange={(event) =>
                      setReplaceEffectiveFrom(event.target.value)
                    }
                  />
                  <Input
                    placeholder="Reference code"
                    value={replaceReferenceCode}
                    onChange={(event) =>
                      setReplaceReferenceCode(event.target.value)
                    }
                  />
                  <Input
                    placeholder="Change reason"
                    value={replaceReason}
                    onChange={(event) => setReplaceReason(event.target.value)}
                  />
                </div>
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {visibleScheduleFields.map((field) => (
                          <TableHead key={field}>{FIELD_LABELS[field]}</TableHead>
                        ))}
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduleRows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {visibleScheduleFields.map((field) => (
                            <TableCell key={field} className="min-w-36">
                              <Input
                                value={row[field]}
                                placeholder={FIELD_LABELS[field]}
                                onChange={(event) =>
                                  updateScheduleRow(
                                    rowIndex,
                                    field,
                                    event.target.value,
                                  )
                                }
                              />
                            </TableCell>
                          ))}
                          <TableCell>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={scheduleRows.length === 1}
                              onClick={() =>
                                setScheduleRows((current) =>
                                  current.filter((_, index) => index !== rowIndex),
                                )
                              }
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setScheduleRows((current) => [
                        ...current,
                        { ...emptyRowForm },
                      ])
                    }
                  >
                    Add Row
                  </Button>
                  <Button
                    type="button"
                    onClick={handleUpdateContribution}
                    disabled={saving}
                    className="ml-2"
                  >
                    Update Contribution
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {editingRow ? (
            <Card className="border-border/70 bg-card/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Edit Row as New Version</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {editingRow.section.title} row {formatCurrency(editingRow.row.lowerBound)} to{" "}
                  {formatCurrency(editingRow.row.upperBound)}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  {Object.keys(emptyRowForm).map((key) => (
                    <Input
                      key={key}
                      placeholder={key}
                      value={editingRow.values[key as keyof RowFormState]}
                      onChange={(event) =>
                        setEditingRow((current) =>
                          current
                            ? {
                                ...current,
                                values: {
                                  ...current.values,
                                  [key]: event.target.value,
                                },
                              }
                            : current,
                        )
                      }
                    />
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    type="datetime-local"
                    value={editingRow.effectiveFrom}
                    onChange={(event) =>
                      setEditingRow((current) =>
                        current
                          ? { ...current, effectiveFrom: event.target.value }
                          : current,
                      )
                    }
                  />
                  <Input
                    placeholder="Reference code"
                    value={editingRow.referenceCode}
                    onChange={(event) =>
                      setEditingRow((current) =>
                        current
                          ? { ...current, referenceCode: event.target.value }
                          : current,
                      )
                    }
                  />
                  <Input
                    placeholder="Change reason"
                    value={editingRow.changeReason}
                    onChange={(event) =>
                      setEditingRow((current) =>
                        current
                          ? { ...current, changeReason: event.target.value }
                          : current,
                      )
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingRow(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAdjustRow}
                    disabled={saving}
                  >
                    Save New Version
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <ContributionBracketSidebar
            sections={sections}
            loading={loading}
            canManage={canManage}
            onEditRow={(row, section) =>
              setEditingRow({
                row,
                section,
                values: rowToForm(row),
                effectiveFrom: toInputDateTime(),
                referenceCode: row.referenceCode ?? "",
                changeReason: "",
              })
            }
          />
        </div>
      ) : null}

      {activeTab === "history" ? (
        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Version History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingVersions ? (
                    <TableRow>
                      <TableCell colSpan={9}>Loading versions...</TableCell>
                    </TableRow>
                  ) : versions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>No versions found.</TableCell>
                    </TableRow>
                  ) : (
                    versions.map((version) => (
                      <TableRow key={version.id}>
                        <TableCell>{version.contributionType}</TableCell>
                        <TableCell>{version.payrollFrequency ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{version.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {formatDate(version.effectiveFrom)} to{" "}
                          {formatDate(version.effectiveTo)}
                        </TableCell>
                        <TableCell>{version.referenceCode ?? "—"}</TableCell>
                        <TableCell className="max-w-64 truncate">
                          {version.changeReason ?? "—"}
                        </TableCell>
                        <TableCell>{version.createdByName ?? "System"}</TableCell>
                        <TableCell>{version.rowCount}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void loadDetail(version.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "detail" && detail ? (
        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {detail.contributionType} Version Detail
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Effective {formatDate(detail.effectiveFrom)} to{" "}
              {formatDate(detail.effectiveTo)} · {detail.referenceCode ?? "No reference"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lower</TableHead>
                    <TableHead>Upper</TableHead>
                    <TableHead>EE Fixed</TableHead>
                    <TableHead>ER Fixed</TableHead>
                    <TableHead>EE Rate</TableHead>
                    <TableHead>ER Rate</TableHead>
                    <TableHead>Base Tax</TableHead>
                    <TableHead>Marginal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatCurrency(row.lowerBound)}</TableCell>
                      <TableCell>{formatCurrency(row.upperBound) || "Open"}</TableCell>
                      <TableCell>{formatCurrency(row.employeeFixedAmount) || "—"}</TableCell>
                      <TableCell>{formatCurrency(row.employerFixedAmount) || "—"}</TableCell>
                      <TableCell>{row.employeeRate ?? "—"}</TableCell>
                      <TableCell>{row.employerRate ?? "—"}</TableCell>
                      <TableCell>{formatCurrency(row.baseTax) || "—"}</TableCell>
                      <TableCell>{row.marginalRate ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
