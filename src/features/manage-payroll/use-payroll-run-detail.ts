"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPayrollRunDetails } from "@/actions/payroll/payroll-action";
import type { PayrollRunDetail } from "@/types/payroll";

export function usePayrollRunDetail(selectedRunId: string | null) {
  const cacheRef = useRef(new Map<string, PayrollRunDetail>());
  const requestRef = useRef(0);
  const [run, setRun] = useState<PayrollRunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheDetail = useCallback((detail: PayrollRunDetail | null) => {
    if (!detail) return;
    cacheRef.current.set(detail.payrollId, detail);
    setRun((current) =>
      current?.payrollId === detail.payrollId ? detail : current,
    );
  }, []);

  const loadDetail = useCallback(
    async (payrollId: string, options?: { force?: boolean }) => {
      const force = options?.force === true;
      const cached = cacheRef.current.get(payrollId);

      if (cached && !force) {
        setRun(cached);
        setError(null);
        setLoading(false);
        return cached;
      }

      const requestId = ++requestRef.current;

      try {
        setLoading(true);
        setError(null);
        const result = await getPayrollRunDetails(payrollId);
        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to load payroll run details");
        }

        if (requestRef.current !== requestId) {
          return result.data;
        }

        cacheRef.current.set(payrollId, result.data);
        setRun(result.data);
        return result.data;
      } catch (err) {
        if (requestRef.current === requestId) {
          setRun(null);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load payroll run details",
          );
        }
        return null;
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedRunId) {
      setRun(null);
      setError(null);
      setLoading(false);
      return;
    }

    void loadDetail(selectedRunId);
  }, [loadDetail, selectedRunId]);

  return {
    run,
    loading,
    error,
    loadDetail,
    cacheDetail,
  };
}
