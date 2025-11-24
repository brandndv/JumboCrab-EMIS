"use client";

import { useEffect, useMemo, useState } from "react";

export type ContributionRow = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  avatarUrl?: string | null;
  department?: string;
  eeTotal: number;
  isSet?: boolean;
  updatedAt?: string;
  sssEe?: number;
  isSssActive?: boolean;
  philHealthEe?: number;
  isPhilHealthActive?: boolean;
  pagIbigEe?: number;
  isPagIbigActive?: boolean;
  withholdingEe?: number;
  isWithholdingActive?: boolean;
  // Keep ER values for admin views even if hidden on the directory
  sssEr?: number;
  philHealthEr?: number;
  pagIbigEr?: number;
  withholdingEr?: number;
};

export function useContributionsState() {
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "set" | "not-set">("all");

  // Load the directory from the API; keep it simple for now.
  useEffect(() => {
    refreshContributions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const res = await fetch("/api/contributions");
      if (!res.ok) {
        throw new Error("Failed to fetch contributions");
      }
      const data = await res.json();
      const rows: ContributionRow[] = (data?.data || []).map((row: any) => ({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        employeeCode: row.employeeCode,
        avatarUrl: row.avatarUrl,
        eeTotal: row.eeTotal ?? 0,
        department: row.department,
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
        isPhilHealthActive: row.contribution?.isPhilHealthActive ?? true,
        isPagIbigActive: row.contribution?.isPagIbigActive ?? true,
        isWithholdingActive: row.contribution?.isWithholdingActive ?? true,
      }));
      setContributions(rows);
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
    refreshContributions,
  };
}

export type ContributionsState = ReturnType<typeof useContributionsState>;
