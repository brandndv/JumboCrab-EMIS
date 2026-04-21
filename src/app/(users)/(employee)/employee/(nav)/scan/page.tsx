"use client";

import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { formatZonedTime } from "@/lib/timezone";
import {
  getSelfAttendanceStatus,
  recordSelfPunch,
  verifyFaceAndRecordQrPunch,
} from "@/actions/attendance/attendance-action";
import { acknowledgeKioskQrScan } from "@/actions/attendance/kiosk-attendance-action";
import { collectAttendanceContext } from "@/lib/attendance-security-client";
import {
  FACE_API_LIVENESS_PROMPTS,
  captureFaceVerificationPayload,
  livenessInstructionText,
  loadFaceApiModels,
  type FaceApiLivenessPrompt,
} from "@/lib/face-api-client";

type KioskParsed = { kioskId: string; nonce: string; exp: number; raw: string };
type PunchType = "TIME_IN" | "BREAK_IN" | "BREAK_OUT" | "TIME_OUT";
type Step = "READY" | "SCANNING" | "PROCESSING" | "FACE" | "RESULT" | "ERROR";

type ScanResult = {
  username: string;
  employeeName: string;
  employeeCode: string;
  punchType: PunchType;
  punchTime: string;
  kioskId: string;
  faceVerified?: boolean;
  faceDistance?: number | null;
};

type PendingFacePunch = {
  parsed: KioskParsed;
  username: string;
  employeeName: string;
  employeeCode: string;
  nextPunch: PunchType;
  attendanceContext: {
    latitude: number | null;
    longitude: number | null;
  };
  livenessPrompt: FaceApiLivenessPrompt;
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

function parseKioskQuery(searchParams: {
  get: (name: string) => string | null;
}): KioskParsed | null {
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
    qr_expired: "Kiosk QR expired. Please scan a fresh QR.",
    face_not_enabled: "Face recognition is not enabled for QR punches.",
    missing_face_descriptor: "Face scan is required before punching.",
    no_face_enrollment:
      "No active face enrollment found. Ask a manager to enroll your face.",
    liveness_failed: "Face liveness check failed. Please retry.",
    no_face_detected: "No face detected. Please retry.",
    multiple_faces: "Only one employee may be in frame.",
    face_mismatch: "Face did not match enrolled employee.",
    face_verification_error:
      "Face verification failed. Use supervisor fallback if needed.",
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

const cameraUnavailableMessage =
  "Camera is unavailable in this browser context. iPhone and other phones require HTTPS for camera access on LAN IP addresses. Use the phone Camera app to open the kiosk QR directly, or run the app over HTTPS if face verification is required.";

const inPageScannerUnavailableMessage =
  "This browser cannot open the in-page scanner on this network address. Use the phone Camera app to scan the kiosk QR so it opens this page directly.";

const canUseBrowserCamera = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  typeof navigator !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia);

export default function EmployeeScanPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-8 sm:px-8 lg:px-12">
          <Card className="shadow-sm">
            <CardContent className="py-10">
              <p className="text-sm text-muted-foreground">Loading scanner...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <EmployeeScanPageContent />
    </Suspense>
  );
}

function EmployeeScanPageContent() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceVideoRef = useRef<HTMLVideoElement | null>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);
  const reader = useMemo(() => new BrowserMultiFormatReader(), []);
  const searchParams = useSearchParams();
  const handledChallengeRef = useRef<string | null>(null);
  const toast = useToast();

  const [step, setStep] = useState<Step>("READY");
  const [error, setError] = useState("");
  const [kiosk, setKiosk] = useState<KioskParsed | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [pendingFacePunch, setPendingFacePunch] =
    useState<PendingFacePunch | null>(null);
  const [faceStream, setFaceStream] = useState<MediaStream | null>(null);
  const [faceCameraReady, setFaceCameraReady] = useState(false);
  const [faceModelsReady, setFaceModelsReady] = useState(false);
  const [faceSubmitting, setFaceSubmitting] = useState(false);
  const [browserCameraAvailable, setBrowserCameraAvailable] = useState(true);

  const livenessPrompts = useMemo(() => FACE_API_LIVENESS_PROMPTS, []);

  const submitLegacyPunch = useCallback(
    async (parsed: KioskParsed, pending: PendingFacePunch) => {
      const punchResult = await recordSelfPunch({
        punchType: pending.nextPunch,
        ...pending.attendanceContext,
      });
      if (!punchResult.success || !punchResult.data) {
        throw new Error(
          reasonMessage(
            punchResult.reason,
            punchResult.error || "Failed to record punch",
          ),
        );
      }

      await acknowledgeKioskQrScan({
        kioskId: parsed.kioskId,
        nonce: parsed.nonce,
        exp: parsed.exp,
        username: pending.username,
        employeeName: pending.employeeName,
        employeeCode: pending.employeeCode,
        punchType: punchResult.data.punchType,
        punchTime: punchResult.data.punchTime,
      });

      setResult({
        username: pending.username,
        employeeName: pending.employeeName,
        employeeCode: pending.employeeCode,
        kioskId: parsed.kioskId,
        punchType: punchResult.data.punchType as PunchType,
        punchTime: punchResult.data.punchTime,
      });
      setStep("RESULT");
      toast.success("Punch recorded successfully.", {
        description: `${pending.employeeName} ${formatPunchLabel(
          punchResult.data.punchType as PunchType,
        )} recorded.`,
      });
    },
    [toast],
  );

  const submitPunchFromKioskQr = useCallback(
    async (parsed: KioskParsed) => {
      setKiosk(parsed);
      setStep("PROCESSING");
      setError("");
      setResult(null);
      setPendingFacePunch(null);

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
        const securityConfig = statusResult.data.security ?? {
          gpsValidationEnabled: false,
          faceRecognitionEnabled: false,
          faceRequiredForQrPunch: false,
          faceLivenessRequired: true,
          faceMatchMaxDistance: 0.5,
          faceFailureMode: "BLOCK",
        };
        const attendanceContext = await collectAttendanceContext(securityConfig);
        const employeeName =
          `${statusResult.data.employee.firstName} ${statusResult.data.employee.lastName}`.trim();
        const pending: PendingFacePunch = {
          parsed,
          username: statusResult.data.username || "",
          employeeName,
          employeeCode: statusResult.data.employee.employeeCode,
          nextPunch,
          attendanceContext,
          livenessPrompt:
            livenessPrompts[Math.floor(Math.random() * livenessPrompts.length)] ??
            "Blink twice",
        };

        if (
          securityConfig.faceRecognitionEnabled &&
          securityConfig.faceRequiredForQrPunch
        ) {
          if (!canUseBrowserCamera()) {
            if (securityConfig.faceFailureMode === "FLAG") {
              toast.info("Face check skipped.", {
                description:
                  "Camera is unavailable on this development network address. QR punch fallback mode recorded the punch.",
              });
              await submitLegacyPunch(parsed, pending);
              return;
            }

            throw new Error(cameraUnavailableMessage);
          }

          setPendingFacePunch(pending);
          setStep("FACE");
          return;
        }

        await submitLegacyPunch(parsed, pending);
      } catch (err) {
        const message = toErrorMessage(err, "Network error. Please try again.");
        setError(message);
        setStep("ERROR");
        toast.error("Failed to record punch.", {
          description: message,
        });
      }
    },
    [livenessPrompts, submitLegacyPunch, toast],
  );

  useEffect(() => {
    setBrowserCameraAvailable(canUseBrowserCamera());
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
        if (!canUseBrowserCamera()) {
          throw new Error(inPageScannerUnavailableMessage);
        }

        const video = videoRef.current;
        if (!video) return;

        let preferredDeviceId: string | undefined;
        try {
          const devices =
            await BrowserMultiFormatReader.listVideoInputDevices();
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
        const msg = toErrorMessage(
          err,
          "Camera error. Please allow permission.",
        );
        if (
          /enumerate devices|method not supported|mediaDevices|getUserMedia/i.test(
            msg,
          )
        ) {
          setError(inPageScannerUnavailableMessage);
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

  useEffect(() => {
    if (step !== "FACE") {
      faceStreamRef.current?.getTracks().forEach((track) => track.stop());
      faceStreamRef.current = null;
      setFaceStream(null);
      setFaceCameraReady(false);
      setFaceModelsReady(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (!canUseBrowserCamera()) {
          throw new Error(cameraUnavailableMessage);
        }

        await loadFaceApiModels();
        if (!cancelled) {
          setFaceModelsReady(true);
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 720 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        faceStreamRef.current = stream;
        setFaceStream(stream);
      } catch (err) {
        const message = toErrorMessage(
          err,
          "Face camera error. Please allow camera permission.",
        );
        setError(message);
        setStep("ERROR");
      }
    })();

    return () => {
      cancelled = true;
      faceStreamRef.current?.getTracks().forEach((track) => track.stop());
      faceStreamRef.current = null;
      setFaceStream(null);
      setFaceCameraReady(false);
      setFaceModelsReady(false);
    };
  }, [step]);

  useEffect(() => {
    if (step !== "FACE" || !faceStream || !faceVideoRef.current) return;

    const video = faceVideoRef.current;
    setFaceCameraReady(false);

    const markReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setError("");
        setFaceCameraReady(true);
      }
    };

    video.addEventListener("loadedmetadata", markReady);
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    video.addEventListener("playing", markReady);
    video.srcObject = faceStream;

    const frameTimeout = window.setTimeout(() => {
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setError(
          "Camera permission is active, but no video frames are arriving. Close other apps or browser tabs using the camera, then retry.",
        );
      }
    }, 3000);

    void video.play().then(markReady).catch(() => {
      setError("Face camera preview could not start.");
    });

    return () => {
      window.clearTimeout(frameTimeout);
      video.removeEventListener("loadedmetadata", markReady);
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
      video.removeEventListener("playing", markReady);
    };
  }, [faceStream, step]);

  const submitFaceVerification = async () => {
    if (!pendingFacePunch) return;
    const video = faceVideoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setError("Face camera is not ready yet.");
      return;
    }

    try {
      setFaceSubmitting(true);
      setError("");
      const facePayload = await captureFaceVerificationPayload(
        video,
        pendingFacePunch.livenessPrompt,
      );
      const punchResult = await verifyFaceAndRecordQrPunch({
        punchType: pendingFacePunch.nextPunch,
        kioskId: pendingFacePunch.parsed.kioskId,
        nonce: pendingFacePunch.parsed.nonce,
        exp: pendingFacePunch.parsed.exp,
        descriptor: facePayload.descriptor,
        livenessPassed: facePayload.livenessPassed,
        livenessPrompt: facePayload.livenessPrompt,
        faceCount: facePayload.faceCount,
        modelVersion: facePayload.modelVersion,
        faceMetadata: facePayload.metadata,
        ...pendingFacePunch.attendanceContext,
      });

      if (!punchResult.success || !punchResult.data) {
        throw new Error(
          reasonMessage(
            punchResult.reason,
            punchResult.error || "Failed to verify face and record punch",
          ),
        );
      }

      await acknowledgeKioskQrScan({
        kioskId: pendingFacePunch.parsed.kioskId,
        nonce: pendingFacePunch.parsed.nonce,
        exp: pendingFacePunch.parsed.exp,
        username: pendingFacePunch.username,
        employeeName: pendingFacePunch.employeeName,
        employeeCode: pendingFacePunch.employeeCode,
        punchType: punchResult.data.punchType,
        punchTime: punchResult.data.punchTime,
      });

      faceStreamRef.current?.getTracks().forEach((track) => track.stop());
      faceStreamRef.current = null;
      setFaceStream(null);
      setFaceCameraReady(false);
      setFaceModelsReady(false);
      setResult({
        username: pendingFacePunch.username,
        employeeName: pendingFacePunch.employeeName,
        employeeCode: pendingFacePunch.employeeCode,
        kioskId: pendingFacePunch.parsed.kioskId,
        punchType: punchResult.data.punchType as PunchType,
        punchTime: punchResult.data.punchTime,
        faceVerified: Boolean(punchResult.data.faceVerified),
        faceDistance:
          typeof punchResult.data.faceDistance === "number"
            ? punchResult.data.faceDistance
            : null,
      });
      setStep("RESULT");
      toast.success("Face verified. Punch recorded.", {
        description: `${pendingFacePunch.employeeName} ${formatPunchLabel(
          punchResult.data.punchType as PunchType,
        )} recorded.`,
      });
    } catch (err) {
      const message = toErrorMessage(err, "Face verification failed.");
      setError(message);
      toast.error("Failed to record punch.", {
        description: message,
      });
    } finally {
      setFaceSubmitting(false);
    }
  };

  const startScan = () => {
    setError("");
    setResult(null);
    setKiosk(null);
    setPendingFacePunch(null);
    if (!canUseBrowserCamera()) {
      setBrowserCameraAvailable(false);
      setError(inPageScannerUnavailableMessage);
      setStep("ERROR");
      return;
    }
    setStep("SCANNING");
  };

  const reset = () => {
    setKiosk(null);
    setResult(null);
    setError("");
    setPendingFacePunch(null);
    setStep("READY");
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 lg:px-8">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Employee QR Scan</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use your personal phone to scan the kiosk QR and record your next
            attendance punch.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "READY" ? (
            <div className="space-y-3">
              {browserCameraAvailable ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Tap start, allow camera access, then point at the kiosk QR.
                  </p>
                  <Button onClick={startScan}>Start scanning kiosk QR</Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  In-page scanning is unavailable on this network address. Open
                  the phone Camera app and scan the kiosk QR; the QR should open
                  this page with the punch challenge already attached.
                </p>
              )}
            </div>
          ) : null}

          {step === "PROCESSING" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Verifying kiosk QR and preparing secure punch...
              </p>
            </div>
          ) : null}

          {step === "SCANNING" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Point your camera at the kiosk QR code.
              </p>
              <video
                ref={videoRef}
                className="w-full rounded-xl bg-black"
                autoPlay
                playsInline
                muted
              />
              <p className="text-xs text-muted-foreground">
                If camera doesn&apos;t open, check browser permission and use
                HTTPS on real devices.
              </p>
            </div>
          ) : null}

          {step === "FACE" && pendingFacePunch ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <div>
                  <b>Employee:</b> {pendingFacePunch.employeeName}
                </div>
                <div>
                  <b>Next punch:</b>{" "}
                  {formatPunchLabel(pendingFacePunch.nextPunch)}
                </div>
                <div>
                  <b>Liveness prompt:</b> {pendingFacePunch.livenessPrompt}
                </div>
              </div>
              <div className="relative mx-auto max-w-sm overflow-hidden rounded-xl bg-black">
                <div className="pointer-events-none absolute inset-x-3 top-3 z-10 rounded-lg bg-black/75 px-3 py-3 text-center text-xl font-bold tracking-wide text-white">
                  {livenessInstructionText(pendingFacePunch.livenessPrompt)}
                </div>
                <video
                  ref={faceVideoRef}
                  className="aspect-[4/3] w-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Tap verify, then follow the large camera prompt while the app
                reads your face descriptor. No punch-time photo is stored.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground">Face models</p>
                  <p className="font-medium">
                    {faceModelsReady ? "Loaded" : "Loading..."}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground">Camera</p>
                  <p className="font-medium">
                    {faceCameraReady ? "Ready" : "Starting..."}
                  </p>
                </div>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button
                  onClick={() => void submitFaceVerification()}
                  disabled={!faceCameraReady || !faceModelsReady || faceSubmitting}
                >
                  {faceSubmitting ? "Checking liveness..." : "Verify face and punch"}
                </Button>
                <Button variant="outline" onClick={reset} disabled={faceSubmitting}>
                  Cancel
                </Button>
              </div>
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
                {result.faceVerified ? (
                  <div>
                    <b>Face:</b> Verified
                    {result.faceDistance != null
                      ? ` (${result.faceDistance.toFixed(3)})`
                      : ""}
                  </div>
                ) : null}
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
