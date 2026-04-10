"use client";

import {
  listContributionBracketDirectory,
  type ContributionPreviewLine,
  type ContributionBracketViewSection,
  listContributionDirectory,
  type ContributionPreviewRecord,
} from "@/actions/contributions/contributions-action";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ContributionRow = ContributionPreviewRecord;

type ContributionLineKey = "sss" | "philHealth" | "pagIbig" | "withholding";

const resolveContributionLineKey = (
  contributionType: ContributionPreviewLine["contributionType"],
): ContributionLineKey => {
  if (contributionType === "PHILHEALTH") return "philHealth";
  if (contributionType === "PAGIBIG") return "pagIbig";
  if (contributionType === "WITHHOLDING") return "withholding";
  return "sss";
};

const recalculateContributionRow = (row: ContributionRow): ContributionRow => {
  const statutoryLines = [row.sss, row.philHealth, row.pagIbig];
  const previewLines = [...statutoryLines, row.withholding];
  const includedLines = previewLines.filter((line) => line.isIncludedInPayroll);

  return {
    ...row,
    eeTotal: includedLines.reduce((sum, line) => sum + line.employeeShare, 0),
    isReady:
      Boolean(row.dailyRate) &&
      statutoryLines.every(
        (line) => !line.isIncludedInPayroll || line.status === "READY",
      ),
    hasMissingGovernmentIds: statutoryLines.some(
      (line) =>
        line.isIncludedInPayroll && line.status === "MISSING_GOV_ID",
    ),
  };
};

const fetchContributionRows = async (): Promise<ContributionRow[]> => {
  const result = await listContributionDirectory();
  if (!result.success) {
    throw new Error(result.error || "Failed to fetch contributions");
  }

  return result.data || [];
};

export function useContributionsState() {
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [bracketSections, setBracketSections] = useState<
    ContributionBracketViewSection[]
  >([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "ready" | "needs-attention"
  >("all");
  const [departments, setDepartments] = useState<string[]>([]);

  const refreshContributions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, bracketsResult] = await Promise.all([
        fetchContributionRows(),
        listContributionBracketDirectory(),
      ]);
      setContributions(rows);
      if (!bracketsResult.success) {
        throw new Error(bracketsResult.error || "Failed to fetch brackets");
      }
      setBracketSections(bracketsResult.data || []);

      const uniqueDepartments = Array.from(
        new Set(
          rows
            .map((row) => row.department.trim())
            .filter((name) => name.length > 0),
        ),
      );
      uniqueDepartments.sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: "base" }),
      );
      setDepartments(uniqueDepartments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateContributionInclusion = useCallback(
    (input: {
      employeeId: string;
      contributionType: ContributionPreviewLine["contributionType"];
      includeInPayroll: boolean;
      updatedAt?: string;
    }) => {
      const lineKey = resolveContributionLineKey(input.contributionType);

      setContributions((current) =>
        current.map((row) => {
          if (row.employeeId !== input.employeeId) return row;

          const updatedRow = {
            ...row,
            [lineKey]: {
              ...row[lineKey],
              isIncludedInPayroll: input.includeInPayroll,
            },
            updatedAt: input.updatedAt ?? row.updatedAt,
          } satisfies ContributionRow;

          return recalculateContributionRow(updatedRow);
        }),
      );
    },
    [],
  );

  useEffect(() => {
    void refreshContributions();
  }, [refreshContributions]);

  const filteredContributions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return contributions.filter((row) => {
      const matchesSearch = term
        ? `${row.employeeName} ${row.employeeCode}`.toLowerCase().includes(term)
        : true;
      const matchesDept =
        departmentFilter === "all" ||
        row.department.toLowerCase() === departmentFilter.toLowerCase();
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "ready" ? row.isReady : !row.isReady);
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [contributions, departmentFilter, searchTerm, statusFilter]);

  return {
    contributions,
    filteredContributions,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    departmentFilter,
    setDepartmentFilter,
    statusFilter,
    setStatusFilter,
    departments,
    bracketSections,
    refreshContributions,
    updateContributionInclusion,
  };
}

export const ContributionsContext = createContext<
  ReturnType<typeof useContributionsState> | undefined
>(undefined);

export function useContributions() {
  const context = useContext(ContributionsContext);
  if (!context) {
    throw new Error(
      "useContributions must be used within a ContributionsProvider",
    );
  }
  return context;
}

export type ContributionsState = ReturnType<typeof useContributionsState>;
