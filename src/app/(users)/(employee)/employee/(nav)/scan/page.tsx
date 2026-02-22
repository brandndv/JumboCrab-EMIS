"use client";

import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatZonedTime } from "@/lib/timezone";
import {
  getSelfAttendanceStatus,
  recordSelfPunch,
} from "@/actions/attendance/attendance-action";

type KioskParsed = { kioskId: string; nonce: string; exp: number; raw: string };
type PunchType = "TIME_IN" | "BREAK_IN" | "BREAK_OUT" | "TIME_OUT";
type Step = "READY" | "SCANNING" | "PROCESSING" | "RESULT" | "ERROR";

type ScanResult = {
  employeeName: string;
  punchType: PunchType;
  punchTime: string;
  kioskId: string;
};

function parseKioskQr(text: string): KioskParsed | null {
  try {
    const origin = window.location.origin;
    const url = new URL(text, origin);
    const kioskId = url.searchParams.get("k") ?? "";
    const nonce = url.searchParams.get("n") ?? "";
    const e = url.searchParams.get("e") ?? "";
    const exp = Number(e);

    if (!kioskId || !nonce || !exp) return null;
    return { kioskId, nonce, exp, raw: text };
  } catch {
    return null;
  }
}

function parseKioskQuery(searchParams: { get: (name: string) => string | null }): KioskParsed | null {
  const kioskId = searchParams.get("k") ?? "";
  const nonce = searchParams.get("n") ?? "";
  const e = searchParams.get("e") ?? "";
  const exp = Number(e);
  if (!kioskId || !nonce || !exp) return null;
  return { kioskId, nonce, exp, raw: `k=${kioskId}&n=${nonce}&e=${e}` };
}

const reasonMessage = (reason?: string, fallback?: string) => {
  const map: Record<string, string> = {
    unauthorized: "You must sign in first.",
    invalid_date: "Selected date is invalid.",
    employee_not_found: "Employee record not found for this user.",
    ip_not_allowed: "This device is not allowed to punch.",
    invalid_punch_type: "Punch type is invalid.",
    missing_credentials: "Username and password are required.",
    user_not_eligible: "User is not eligible to punch.",
    invalid_credentials: "Incorrect username or password.",
    wrong_date: "Clock in is only allowed on today's scheduled shift date.",
    no_shift_today: "No scheduled shift for today.",
    too_early: "Too early to clock in.",
    too_late: "Cannot clock in after your scheduled end time.",
    already_clocked_out: "Already clocked out today.",
    invalid_sequence: "Wrong punch order. Follow the punch sequence.",
  };
  if (reason && map[reason]) return map[reason];
  return fallback || "Failed to punch";
};

const formatPunchLabel = (punchType: PunchType) => {
  switch (punchType) {
    case "TIME_IN":
      return "TIME IN";
    case "TIME_OUT":
      return "TIME OUT";
    case "BREAK_IN":
      return "BREAK START";
    case "BREAK_OUT":
      return "BREAK END";
  }
  const unreachable: never = punchType;
  return unreachable;
};

const toErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export default function EmployeeScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reader = useMemo(() => new BrowserMultiFormatReader(), []);
  const searchParams = useSearchParams();
  const handledChallengeRef = useRef<string | null>(null);

  const [step, setStep] = useState<Step>("READY");
  const [error, setError] = useState("");
  const [kiosk, setKiosk] = useState<KioskParsed | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  const submitPunchFromKioskQr = useCallback(async (parsed: KioskParsed) => {
    setKiosk(parsed);
    setStep("PROCESSING");
    setError("");
    setResult(null);

    if (Date.now() > parsed.exp) {
      setError("Kiosk QR expired. Please rescan (kiosk QR rotates).");
      setStep("ERROR");
      return;
    }

    try {
      const statusResult = await getSelfAttendanceStatus();
      if (!statusResult.success || !statusResult.data) {
        throw new Error(
          reasonMessage(
            statusResult.reason,
            statusResult.error || "Failed to load attendance status",
          ),
        );
      }

      const lastType = statusResult.data.lastPunch?.punchType as
        | PunchType
        | undefined;
      const allowedNext: Record<PunchType | "NONE", PunchType> = {
        NONE: "TIME_IN",
        TIME_OUT: "TIME_IN",
        TIME_IN: "BREAK_IN",
        BREAK_IN: "BREAK_OUT",
        BREAK_OUT: "TIME_OUT",
      };
      if (lastType === "TIME_OUT") {
        throw new Error(reasonMessage("already_clocked_out"));
      }
      const nextPunch = allowedNext[lastType ?? "NONE"];

      const punchResult = await recordSelfPunch({
        punchType: nextPunch,
      });
      if (!punchResult.success || !punchResult.data) {
        throw new Error(
          reasonMessage(
            punchResult.reason,
            punchResult.error || "Failed to record punch",
          ),
        );
      }

      const employeeName =
        `${statusResult.data.employee.firstName} ${statusResult.data.employee.lastName}`.trim();
      setResult({
        employeeName,
        kioskId: parsed.kioskId,
        punchType: punchResult.data.punchType as PunchType,
        punchTime: punchResult.data.punchTime,
      });
      setStep("RESULT");
    } catch (err) {
      setError(toErrorMessage(err, "Network error. Please try again."));
      setStep("ERROR");
    }
  }, []);

  useEffect(() => {
    const parsed = parseKioskQuery(searchParams);
    if (!parsed) return;

    const challengeKey = `${parsed.kioskId}:${parsed.nonce}:${parsed.exp}`;
    if (handledChallengeRef.current === challengeKey) return;
    handledChallengeRef.current = challengeKey;

    void submitPunchFromKioskQr(parsed);
  }, [searchParams, submitPunchFromKioskQr]);

  useEffect(() => {
    if (step !== "SCANNING") return;

    let stopped = false;
    let controls: IScannerControls | null = null;

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;

        let preferredDeviceId: string | undefined;
        try {
          const devices = await BrowserMultiFormatReader.listVideoInputDevices();
          preferredDeviceId =
            devices.find((d) => /back|rear|environment/i.test(d.label))
              ?.deviceId ?? devices[0]?.deviceId;
        } catch {
          preferredDeviceId = undefined;
        }

        controls = await reader.decodeFromVideoDevice(
          preferredDeviceId,
          video,
          async (result, _error, scannerControls) => {
            if (!result || stopped) return;

            const text = result.getText();
            const parsed = parseKioskQr(text);

            if (!parsed) {
              setError(
                "Invalid kiosk QR. Please scan the QR shown on the kiosk screen.",
              );
              setStep("ERROR");
              stopped = true;
              scannerControls.stop();
              return;
            }

            stopped = true;
            scannerControls.stop();
            void submitPunchFromKioskQr(parsed);
          },
        );
        if (stopped && controls) {
          controls.stop();
        }
      } catch (err) {
        const msg = toErrorMessage(err, "Camera error. Please allow permission.");
        if (
          /enumerate devices|method not supported|mediaDevices|getUserMedia/i.test(
            msg,
          )
        ) {
          setError(
            "This browser cannot open the in-page scanner. Use your phone Camera app to scan the kiosk QR so it opens this page directly.",
          );
        } else {
          setError(msg);
        }
        setStep("ERROR");
        controls?.stop();
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [reader, step, submitPunchFromKioskQr]);

  const startScan = () => {
    setError("");
    setResult(null);
    setKiosk(null);
    setStep("SCANNING");
  };

  const reset = () => {
    setKiosk(null);
    setResult(null);
    setError("");
    setStep("READY");
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Employee QR Scan</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use your personal phone to scan the kiosk QR and record your next attendance punch.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "READY" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Tap start, allow camera access, then point at the kiosk QR.
              </p>
              <Button onClick={startScan}>Start scanning kiosk QR</Button>
            </div>
          ) : null}

          {step === "PROCESSING" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Verifying kiosk QR and submitting your punch...
              </p>
            </div>
          ) : null}

          {step === "SCANNING" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Point your camera at the kiosk QR code.
              </p>
              <video ref={videoRef} className="w-full rounded-xl bg-black" />
              <p className="text-xs text-muted-foreground">
                If camera doesn&apos;t open, check browser permission and use HTTPS
                on real devices.
              </p>
            </div>
          ) : null}

          {step === "RESULT" && kiosk && result ? (
            <div className="space-y-3">
              <p className="text-sm text-green-700">Submitted successfully.</p>
              <div className="rounded-lg border p-3 text-sm">
                <div>
                  <b>Employee:</b> {result.employeeName}
                </div>
                <div>
                  <b>Punch:</b> {formatPunchLabel(result.punchType)}
                </div>
                <div>
                  <b>Time:</b>{" "}
                  {formatZonedTime(result.punchTime, {
                    hour12: true,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </div>
                <div>
                  <b>Kiosk:</b> {result.kioskId}
                </div>
                <div>
                  <b>QR Expires:</b> {new Date(kiosk.exp).toLocaleTimeString()}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={startScan}>Scan again</Button>
                <Button variant="outline" onClick={reset}>
                  Done
                </Button>
              </div>
            </div>
          ) : null}

          {step === "ERROR" ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <div className="flex gap-2">
                <Button onClick={startScan}>Try again</Button>
                <Button variant="outline" onClick={reset}>
                  Back
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
