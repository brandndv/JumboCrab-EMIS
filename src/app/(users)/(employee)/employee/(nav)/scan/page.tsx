"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { QrCode, RefreshCcw, ShieldCheck } from "lucide-react";
import { getEmployeeAttendanceQr } from "@/actions/attendance/attendance-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";
import { formatZonedTime } from "@/lib/timezone";

type AttendancePunchMode =
  | "QR_ONLY"
  | "EMPLOYEE_QR_KIOSK_FACE"
  | "SEARCH_EMPLOYEE_KIOSK_FACE";

type EmployeeAttendanceQrPayload = {
  token: string;
  expiresAt: number;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  attendancePunchMode: AttendancePunchMode;
};

const QR_REFRESH_BUFFER_MS = 2_000;

const modeCopy: Record<
  AttendancePunchMode,
  { title: string; description: string }
> = {
  QR_ONLY: {
    title: "Show this QR at the kiosk",
    description: "Kiosk scans your QR and records the next allowed punch.",
  },
  EMPLOYEE_QR_KIOSK_FACE: {
    title: "Show this QR, then face kiosk camera",
    description:
      "Kiosk scans your QR first, then verifies your face before punch is recorded.",
  },
  SEARCH_EMPLOYEE_KIOSK_FACE: {
    title: "Kiosk search and face mode is active",
    description:
      "QR is not needed right now. Ask kiosk operator to search your name, then face the kiosk camera.",
  },
};

export default function EmployeeScanPage() {
  const toast = useToast();
  const [payload, setPayload] = useState<EmployeeAttendanceQrPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const loadQr = useCallback(
    async (showToast = false) => {
      try {
        setRefreshing(true);
        setError(null);
        const result = await getEmployeeAttendanceQr();
        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to load attendance QR");
        }

        setPayload(result.data as EmployeeAttendanceQrPayload);
        if (showToast) {
          toast.success("Attendance QR refreshed.");
        }
      } catch (err) {
        setPayload(null);
        setError(
          err instanceof Error ? err.message : "Failed to load attendance QR",
        );
        if (showToast) {
          toast.error("Failed to refresh attendance QR.", {
            description:
              err instanceof Error ? err.message : "Failed to load attendance QR",
          });
        }
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadQr();
  }, [loadQr]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!payload) return;

    const refreshIn = payload.expiresAt - Date.now() - QR_REFRESH_BUFFER_MS;
    if (refreshIn <= 0) {
      void loadQr();
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadQr();
    }, refreshIn);

    return () => window.clearTimeout(timeout);
  }, [loadQr, payload]);

  const secondsLeft = payload
    ? Math.max(0, Math.ceil((payload.expiresAt - now) / 1000))
    : 0;
  const mode = payload?.attendancePunchMode ?? "QR_ONLY";
  const copy = modeCopy[mode];
  const expiryTime = useMemo(() => {
    if (!payload) return null;
    return formatZonedTime(new Date(payload.expiresAt), {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [payload]);

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
              <QrCode className="h-3.5 w-3.5" />
              Attendance QR
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl">My Attendance QR</CardTitle>
              <p className="text-sm text-muted-foreground">{copy.description}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-xl border border-border/70 bg-muted/10 p-6 text-sm text-muted-foreground">
                Loading attendance QR...
              </div>
            ) : null}

            {payload ? (
              <>
                <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                  <p className="text-sm font-semibold">{copy.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {payload.employeeName} ({payload.employeeCode})
                  </p>
                </div>

                {mode !== "SEARCH_EMPLOYEE_KIOSK_FACE" ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex w-full justify-center rounded-2xl border border-border/70 bg-white p-6">
                      <QRCode value={payload.token} size={240} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        Refreshes automatically
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Expires in {secondsLeft}s
                        {expiryTime ? ` at ${expiryTime}` : ""}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-900">
                    Search-and-face mode active. Kiosk will not scan your QR in
                    this mode.
                  </div>
                )}

                <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">How this works</p>
                      <p className="text-muted-foreground">
                        Open this page at the kiosk, then follow the kiosk
                        instructions. Your QR is short-lived and tied to your
                        current signed-in account.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadQr(true)}
                disabled={refreshing}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                {refreshing ? "Refreshing..." : "Refresh QR"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
