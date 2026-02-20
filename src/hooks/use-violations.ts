"use client";

import { getViolations, type ViolationRow } from "@/actions/violations/violations-action";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
// import { setErrorMap } from "zod";

export type violationRow = ViolationRow;

export function useViolationsState() {
  const [violations, setViolations] = useState<violationRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [violationType, setViolationType] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING" | "WAIVED" | "DEDUCTED"
  >("ALL");

  useEffect(() => {
    refreshViolations();
  }, []);

  const filteredViolations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return violations.filter((row) => {
      const matchesSearch = term
        ? `${row.employeeName} ${row.employeeCode}`.toLowerCase().includes(term)
        : true;
      const matchesViolationType =
        violationType === "ALL" ||
        row.violationType.toLowerCase() === violationType.toLowerCase();
      const matchesStatus =
        statusFilter === "ALL" || row.status.toUpperCase() === statusFilter;
      return matchesSearch && matchesViolationType && matchesStatus;
    });
  }, [searchTerm, statusFilter, violationType, violations]);

  const refreshViolations = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getViolations();
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch violations");
      }
      setViolations(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  return {
    violations,
    setViolations,
    filteredViolations,
    loading,
    refreshViolations,
    error,
    searchTerm,
    setSearchTerm,
    violationType,
    setViolationType,
    statusFilter,
    setStatusFilter,
  };
}

export const violationsContext = createContext<
  ReturnType<typeof useViolationsState> | undefined
>(undefined);

export const useViolations = () => {
  const context = useContext(violationsContext);
  if (!context) {
    throw new Error("useViolations must be used within a violationsProvider");
  }
  return context;
};

export type ViolationsState = ReturnType<typeof useViolationsState>;
