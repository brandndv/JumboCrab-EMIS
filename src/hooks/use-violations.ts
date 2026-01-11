"use client";

import { useEffect, useMemo, useState } from "react";
// import { setErrorMap } from "zod";

export type violationRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  avatarUrl?: string | null;
  violationType: string;
  violationDate: string;
  amount?: number;
  paidAmount: number;
  remainingAmount: number;
  installmentAmount?: number;
  status: string;
  remarks?: string;
  createdAt: string;
};

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
      const res = await fetch("/api/violations");
      if (!res.ok) {
        throw new Error("Failed to fetch violations");
      }
      const data = await res.json();
      const row: violationRow[] = (data?.data || []).map((row: any) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employeeName ?? "",
        employeeCode: row.employeeCode ?? "",
        avatarUrl: row.avatarUrl ?? null,
        violationType: row.violationType,
        violationDate: row.violationDate,
        amount: row.amount,
        paidAmount: row.paidAmount,
        remainingAmount: row.remainingAmount,
        installmentAmount: row.installmentAmount,
        status: row.status,
        remarks: row.remarks,
        createdAt: row.createdAt,
      }));
      setViolations(row);
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

export type ViolationsState = ReturnType<typeof useViolationsState>;
