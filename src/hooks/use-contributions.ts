"use client";

import {
  listContributionDirectory,
  type ContributionPreviewRecord,
} from "@/actions/contributions/contributions-action";
import type { PayrollFrequency } from "@prisma/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ContributionRow = ContributionPreviewRecord;

const fetchContributionRows = async (
  previewFrequency: PayrollFrequency,
): Promise<ContributionRow[]> => {
  const result = await listContributionDirectory({ previewFrequency });
  if (!result.success) {
    throw new Error(result.error || "Failed to fetch contributions");
  }

  return result.data || [];
};

export function useContributionsState() {
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "ready" | "needs-attention"
  >("all");
  const [previewFrequency, setPreviewFrequency] =
    useState<PayrollFrequency>("BIMONTHLY");
  const [departments, setDepartments] = useState<string[]>([]);

  const refreshContributions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchContributionRows(previewFrequency);
      setContributions(rows);

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
  }, [previewFrequency]);

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
    previewFrequency,
    setPreviewFrequency,
    refreshContributions,
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
