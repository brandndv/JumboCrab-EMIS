"use client";

import { listContributionDirectory } from "@/actions/contributions/contributions-action";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ContributionRow = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  avatarUrl?: string | null;
  department?: string;
  payrollFrequency?: "WEEKLY" | "BIMONTHLY" | "MONTHLY";
  currencyCode?: string;
  eeTotal: number;
  isSet?: boolean;
  updatedAt?: string;
  sssEe?: number;
  isSssActive?: boolean;
  sssSchedule?: "PER_PAYROLL" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "AD_HOC";
  philHealthEe?: number;
  isPhilHealthActive?: boolean;
  philHealthSchedule?: "PER_PAYROLL" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "AD_HOC";
  pagIbigEe?: number;
  isPagIbigActive?: boolean;
  pagIbigSchedule?: "PER_PAYROLL" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "AD_HOC";
  withholdingEe?: number;
  isWithholdingActive?: boolean;
  withholdingSchedule?: "PER_PAYROLL" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "AD_HOC";
  // Keep ER values for admin views even if hidden on the directory
  sssEr?: number;
  philHealthEr?: number;
  pagIbigEr?: number;
  withholdingEr?: number;
};

type ContributionDirectoryRow = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  avatarUrl?: string | null;
  department?: string;
  eeTotal: number;
  isSet?: boolean;
  updatedAt?: string;
  contribution?: Partial<ContributionRow> | null;
};

const mapContributionRow = (row: ContributionDirectoryRow): ContributionRow => ({
  employeeId: row.employeeId,
  employeeName: row.employeeName,
  employeeCode: row.employeeCode,
  avatarUrl: row.avatarUrl,
  eeTotal: row.eeTotal ?? 0,
  department: typeof row.department === "string" ? row.department : "",
  payrollFrequency: row.contribution?.payrollFrequency ?? "BIMONTHLY",
  currencyCode: row.contribution?.currencyCode ?? "PHP",
  isSet: row.isSet,
  updatedAt: row.updatedAt,
  sssEe: row.contribution?.sssEe ?? 0,
  sssEr: row.contribution?.sssEr ?? 0,
  philHealthEe: row.contribution?.philHealthEe ?? 0,
  philHealthEr: row.contribution?.philHealthEr ?? 0,
  pagIbigEe: row.contribution?.pagIbigEe ?? 0,
  pagIbigEr: row.contribution?.pagIbigEr ?? 0,
  withholdingEe: row.contribution?.withholdingEe ?? 0,
  withholdingEr: row.contribution?.withholdingEr ?? 0,
  isSssActive: row.contribution?.isSssActive ?? true,
  sssSchedule: row.contribution?.sssSchedule ?? "PER_PAYROLL",
  isPhilHealthActive: row.contribution?.isPhilHealthActive ?? true,
  philHealthSchedule: row.contribution?.philHealthSchedule ?? "PER_PAYROLL",
  isPagIbigActive: row.contribution?.isPagIbigActive ?? true,
  pagIbigSchedule: row.contribution?.pagIbigSchedule ?? "PER_PAYROLL",
  isWithholdingActive: row.contribution?.isWithholdingActive ?? true,
  withholdingSchedule: row.contribution?.withholdingSchedule ?? "PER_PAYROLL",
});

const fetchContributionRows = async (): Promise<ContributionRow[]> => {
  const result = await listContributionDirectory();
  if (!result.success) {
    throw new Error(result.error || "Failed to fetch contributions");
  }

  return (result.data || []).map((row) => mapContributionRow(row));
};

export function useContributionsState() {
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "set" | "not-set">(
    "all"
  );
  const [departments, setDepartments] = useState<string[]>([]);

  // Load the directory from the API; keep it simple for now.
  useEffect(() => {
    let isActive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchContributionRows();
        if (!isActive) return;
        setContributions(rows);

        const uniqueDepartments = Array.from(
          new Set(
            rows
              .map((r) =>
                typeof r.department === "string" ? r.department.trim() : ""
              )
              .filter((name) => name.length > 0)
          )
        ) as string[];
        uniqueDepartments.sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        );
        setDepartments(uniqueDepartments);
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, []);

  const filteredContributions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return contributions.filter((row) => {
      const matchesSearch = term
        ? `${row.employeeName} ${row.employeeCode}`.toLowerCase().includes(term)
        : true;
      const matchesDept =
        departmentFilter === "all" ||
        (row.department || "").toLowerCase() === departmentFilter.toLowerCase();
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "set" ? row.isSet : !row.isSet);
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [contributions, departmentFilter, searchTerm, statusFilter]);

  const refreshContributions = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchContributionRows();
      setContributions(rows);

      const uniqueDepartments = Array.from(
        new Set(
          rows
            .map((r) =>
              typeof r.department === "string" ? r.department.trim() : ""
            )
            .filter((name) => name.length > 0)
        )
      ) as string[];
      uniqueDepartments.sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );
      setDepartments(uniqueDepartments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

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
      "useContributions must be used within a ContributionsProvider"
    );
  }
  return context;
}

export type ContributionsState = ReturnType<typeof useContributionsState>;
