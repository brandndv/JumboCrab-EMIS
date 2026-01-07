"use client";

import { useEffect, useState } from "react";
import { setErrorMap } from "zod";

export type violationRow = {
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
  const [violationType, setViolationType] = useState<string>("all");
  const [status, setStatus] = useState<
    "ALL" | "PENDING" | "WAIVED" | "DEDUCTED"
  >("ALL");

  useEffect(() => {
    refreshViolations();
  }, []);

  const refreshViolations = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("api/violations");
      if (!res.ok) {
        throw new Error("Failed to fetch violations");
      }
      const data = await res.json();
      const row: violationRow[] = (data?.data || []).map((row: any) => ({
        id: row.id,
        employeeId: row.employeeId,
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
    } catch (error) {}
  };
}
