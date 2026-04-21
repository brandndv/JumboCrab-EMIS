"use client";

import { useEffect, useRef, useState } from "react";
import {
  enrollEmployeeFace,
  listEmployeeFaceEnrollments,
  listEmployeeFaceVerificationAttempts,
  revokeEmployeeFaceEnrollment,
} from "@/actions/attendance/attendance-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InlineLoadingState } from "@/components/loading/loading-states";
import { useToast } from "@/components/ui/toast-provider";
import {
  captureFaceDescriptor,
  loadFaceApiModels,
  type FaceApiDescriptorResult,
} from "@/lib/face-api-client";

type FaceEnrollmentRow = {
  id: string;
  employeeId: string;
  sampleCount: number;
  modelVersion: string;
  consentText: string | null;
  consentedAt: string | null;
  enrolledByUserId: string | null;
  revokedByUserId: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FaceAttemptRow = {
  id: string;
  punchType: string | null;
  status: string;
  reason: string | null;
  distance: number | null;
  threshold: number | null;
  livenessPassed: boolean | null;
  livenessPrompt: string | null;
  faceCount: number | null;
  modelVersion: string | null;
  createdAt: string;
};

const REQUIRED_SAMPLES = 3;
const MAX_SAMPLES = 5;
const MIN_DETECTION_SCORE = 0.52;
const MIN_FACE_BOX_RATIO = 0.16;
const MAX_FACE_BOX_RATIO = 0.72;

const enrollmentSteps = [
  {
    label: "Center",
    prompt: "CENTER FACE",
    hint: "Look straight at the camera.",
  },
  {
    label: "Left",
    prompt: "TURN LEFT",
    hint: "Turn your head slightly left.",
  },
  {
    label: "Right",
    prompt: "TURN RIGHT",
    hint: "Turn your head slightly right.",
  },
  {
    label: "Blink",
    prompt: "BLINK ONCE",
    hint: "Blink once, then hold still.",
  },
  {
    label: "Finish",
    prompt: "HOLD STILL",
    hint: "Look straight again for the final sample.",
  },
] as const;

const cameraUnavailableMessage =
  "Camera is unavailable in this browser context. Open this page over HTTPS or use localhost on the same device.";

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const getSampleReadiness = (
  sample: FaceApiDescriptorResult,
  stepIndex = 0,
) => {
  const { detectionScore, faceBoxRatio, yawRatio } = sample.metadata;

  if (detectionScore < MIN_DETECTION_SCORE) {
    return {
      ready: false,
      message: "Need brighter light",
      detail: `Face score ${detectionScore.toFixed(2)}`,
    };
  }

  if (faceBoxRatio < MIN_FACE_BOX_RATIO) {
    return {
      ready: false,
      message: "Move closer",
      detail: "Face is too small in frame",
    };
  }

  if (faceBoxRatio > MAX_FACE_BOX_RATIO) {
    return {
      ready: false,
      message: "Move back a little",
      detail: "Face is too close to camera",
    };
  }

  if (stepIndex === 1 && (yawRatio == null || yawRatio < 0.05)) {
    return {
      ready: false,
      message: "Turn left a little more",
      detail: "Pose sample needs a slight left turn",
    };
  }

  if (stepIndex === 2 && (yawRatio == null || yawRatio > -0.05)) {
    return {
      ready: false,
      message: "Turn right a little more",
      detail: "Pose sample needs a slight right turn",
    };
  }

  if (stepIndex >= 4 && yawRatio != null && Math.abs(yawRatio) > 0.12) {
    return {
      ready: false,
      message: "Look straight again",
      detail: "Final sample should face the camera",
    };
  }

  return {
    ready: true,
    message: "Good frame",
    detail: `Face score ${detectionScore.toFixed(2)}`,
  };
};

export function EmployeeFaceEnrollmentCard({
  employeeId,
}: {
  employeeId: string;
}) {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCaptureBusyRef = useRef(false);
  const lastAutoCaptureAtRef = useRef(0);
  const [rows, setRows] = useState<FaceEnrollmentRow[]>([]);
  const [attempts, setAttempts] = useState<FaceAttemptRow[]>([]);
  const [samples, setSamples] = useState<FaceApiDescriptorResult[]>([]);
  const [lastPreview, setLastPreview] = useState<FaceApiDescriptorResult | null>(
    null,
  );
  const [liveFeedback, setLiveFeedback] = useState(
    "Open camera and center one face.",
  );
  const [autoCapture, setAutoCapture] = useState(true);
  const [capturePulse, setCapturePulse] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeEnrollment = rows.find((row) => row.isActive) ?? null;
  const currentStep =
    enrollmentSteps[Math.min(samples.length, enrollmentSteps.length - 1)];
  const progressPercent = Math.min(
    100,
    Math.round((samples.length / REQUIRED_SAMPLES) * 100),
  );
  const latestScore = lastPreview?.metadata.detectionScore;
  const latestFaceSize = lastPreview?.metadata.faceBoxRatio;
  const latestYaw = lastPreview?.metadata.yawRatio;
  const poseLabel =
    latestYaw == null
      ? "Waiting"
      : latestYaw > 0.08
        ? "Left turn"
        : latestYaw < -0.08
          ? "Right turn"
          : "Straight";

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listEmployeeFaceEnrollments(employeeId);
      const attemptsResult =
        await listEmployeeFaceVerificationAttempts(employeeId);
      if (!result.success) {
        throw new Error(result.error || "Failed to load face enrollments");
      }
      if (!attemptsResult.success) {
        throw new Error(
          attemptsResult.error || "Failed to load face verification attempts",
        );
      }
      setRows((result.data as FaceEnrollmentRow[] | undefined) ?? []);
      setAttempts((attemptsResult.data as FaceAttemptRow[] | undefined) ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load face enrollments",
      );
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setLastPreview(null);
    setLiveFeedback("Open camera and center one face.");
    setCapturePulse(false);
    autoCaptureBusyRef.current = false;
    lastAutoCaptureAtRef.current = 0;
    setCameraReady(false);
    setCameraOpen(false);
  };

  const startCamera = async () => {
    try {
      setError(null);
      setSamples([]);
      setLastPreview(null);
      setLiveFeedback("Loading face models...");
      setCapturePulse(false);
      autoCaptureBusyRef.current = false;
      lastAutoCaptureAtRef.current = 0;
      setCameraReady(false);
      setModelsReady(false);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraStream(null);
      setCameraOpen(true);
      await loadFaceApiModels();
      setModelsReady(true);
      setLiveFeedback("Allow camera, then center one face.");
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error(cameraUnavailableMessage);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraStream(stream);
      setLiveFeedback("Camera starting...");
    } catch (err) {
      setCameraOpen(false);
      setCameraReady(false);
      setCameraStream(null);
      setError(
        err instanceof Error ? err.message : "Camera permission was denied.",
      );
    }
  };

  const captureSample = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    try {
      setCapturing(true);
      setError(null);
      const sample = await captureFaceDescriptor(video);
      const readiness = getSampleReadiness(sample, samples.length);
      setLastPreview(sample);
      setLiveFeedback(readiness.ready ? "Sample saved" : readiness.message);
      if (!readiness.ready) {
        setError(readiness.detail);
        return;
      }
      setSamples((current) =>
        current.length >= MAX_SAMPLES ? current : [...current, sample],
      );
      setCapturePulse(true);
      window.setTimeout(() => setCapturePulse(false), 280);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Face sample could not be captured.",
      );
      setLiveFeedback("Face not ready");
    } finally {
      setCapturing(false);
    }
  };

  const submitEnrollment = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = await enrollEmployeeFace({
        employeeId,
        descriptors: samples.map((sample) => sample.descriptor),
        modelVersion: samples[0]?.modelVersion ?? null,
        descriptorMetadata: {
          samples: samples.map((sample) => sample.metadata),
        },
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to enroll face");
      }
      toast.success("Face enrollment saved.", {
        description: "Encrypted face template is now active for QR punches.",
      });
      stopCamera();
      setSamples([]);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to enroll face";
      setError(message);
      toast.error("Failed to enroll face.", { description: message });
    } finally {
      setSaving(false);
    }
  };

  const revokeActiveEnrollment = async () => {
    if (!activeEnrollment) return;
    try {
      setSaving(true);
      const result = await revokeEmployeeFaceEnrollment({
        enrollmentId: activeEnrollment.id,
        reason: "Revoked from employee profile.",
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to revoke face enrollment");
      }
      toast.success("Face enrollment revoked.");
      await load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to revoke face enrollment";
      setError(message);
      toast.error("Failed to revoke face enrollment.", { description: message });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void load();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  useEffect(() => {
    if (!cameraOpen || !cameraStream || !videoRef.current) return;

    const video = videoRef.current;
    setCameraReady(false);

    const markReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setError(null);
        setCameraReady(true);
      }
    };

    video.addEventListener("loadedmetadata", markReady);
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    video.addEventListener("playing", markReady);
    video.srcObject = cameraStream;

    const frameTimeout = window.setTimeout(() => {
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setError(
          "Camera permission is active, but no video frames are arriving. Close other apps or browser tabs using the camera, then retry.",
        );
      }
    }, 3000);

    void video
      .play()
      .then(markReady)
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Camera preview could not start.",
        );
      });

    return () => {
      window.clearTimeout(frameTimeout);
      video.removeEventListener("loadedmetadata", markReady);
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
      video.removeEventListener("playing", markReady);
    };
  }, [cameraOpen, cameraStream]);

  useEffect(() => {
    if (
      !cameraOpen ||
      !cameraReady ||
      !modelsReady ||
      !autoCapture ||
      saving ||
      capturing ||
      samples.length >= MAX_SAMPLES
    ) {
      return;
    }

    let cancelled = false;

    const scanFrame = async () => {
      const video = videoRef.current;
      if (
        !video ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        autoCaptureBusyRef.current
      ) {
        return;
      }

      autoCaptureBusyRef.current = true;

      try {
        const sample = await captureFaceDescriptor(video);
        if (cancelled) return;

        const readiness = getSampleReadiness(sample, samples.length);
        setLastPreview(sample);
        setLiveFeedback(
          readiness.ready ? `${currentStep.hint} Hold still...` : readiness.message,
        );

        if (
          readiness.ready &&
          Date.now() - lastAutoCaptureAtRef.current > 1600
        ) {
          lastAutoCaptureAtRef.current = Date.now();
          setSamples((current) =>
            current.length >= MAX_SAMPLES ? current : [...current, sample],
          );
          setError(null);
          setLiveFeedback(
            samples.length + 1 >= REQUIRED_SAMPLES
              ? "Enough samples captured. Save when ready."
              : "Sample captured. Follow next prompt.",
          );
          setCapturePulse(true);
          window.setTimeout(() => {
            if (!cancelled) setCapturePulse(false);
          }, 280);
        }
      } catch (err) {
        if (cancelled) return;
        setLastPreview(null);
        setLiveFeedback(
          err instanceof Error ? err.message : "Center one face in frame.",
        );
      } finally {
        autoCaptureBusyRef.current = false;
      }
    };

    const interval = window.setInterval(() => {
      void scanFrame();
    }, 850);
    void scanFrame();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    autoCapture,
    cameraOpen,
    cameraReady,
    capturing,
    currentStep.hint,
    modelsReady,
    samples.length,
    saving,
  ]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Face Enrollment</CardTitle>
            <CardDescription>
              Stores encrypted face templates for QR attendance verification. Raw
              photos are not saved.
            </CardDescription>
          </div>
          <Badge variant={activeEnrollment ? "success" : "secondary"}>
            {activeEnrollment ? "Active" : "Not enrolled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <InlineLoadingState
            label="Loading face enrollment"
            lines={2}
            className="border-border/60 bg-muted/10"
          />
        ) : (
          <div className="rounded-lg border bg-background/60 p-3 text-sm">
            <p>
              <span className="font-medium">Active enrollment:</span>{" "}
              {activeEnrollment
                ? `${activeEnrollment.sampleCount} samples, ${activeEnrollment.modelVersion}`
                : "None"}
            </p>
            <p className="text-muted-foreground">
              Last enrolled: {formatDateTime(activeEnrollment?.createdAt)}
            </p>
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {cameraOpen ? (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr]">
              <div className="space-y-3">
                <div
                  className={`relative mx-auto max-w-sm overflow-hidden rounded-xl bg-black ring-2 transition ${
                    capturePulse ? "ring-emerald-400" : "ring-border/60"
                  }`}
                >
                  <div className="pointer-events-none absolute inset-x-3 top-3 z-10 rounded-lg bg-black/75 px-3 py-3 text-center text-xl font-bold tracking-wide text-white">
                    {currentStep.prompt}
                  </div>
                  <video
                    ref={videoRef}
                    className="aspect-[4/3] w-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                  <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 rounded-lg bg-background/90 px-3 py-2 text-center text-sm font-medium text-foreground">
                    {liveFeedback}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-capture stores descriptors only. Raw photos are not saved.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {samples.length >= REQUIRED_SAMPLES
                        ? "Ready to save"
                        : `Need ${REQUIRED_SAMPLES - samples.length} more`}
                    </span>
                    <span className="text-muted-foreground">
                      {samples.length}/{MAX_SAMPLES}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-5 lg:grid-cols-1 xl:grid-cols-5">
                  {enrollmentSteps.map((step, index) => {
                    const done = samples.length > index;
                    const active = samples.length === index;
                    return (
                      <div
                        key={step.label}
                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                          done
                            ? "border-emerald-500/60 bg-emerald-500/10"
                            : active
                              ? "border-primary/70 bg-primary/10"
                              : "bg-muted/20"
                        }`}
                      >
                        <p className="font-medium">{step.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {done ? "Captured" : active ? step.hint : "Pending"}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border bg-background/60 px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground">Models</p>
                    <p className="font-medium">
                      {modelsReady ? "Loaded" : "Loading..."}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background/60 px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground">Face score</p>
                    <p className="font-medium">
                      {latestScore != null ? latestScore.toFixed(2) : "Waiting"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background/60 px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground">Pose</p>
                    <p className="font-medium">{poseLabel}</p>
                  </div>
                  <div className="rounded-lg border bg-background/60 px-3 py-2 text-sm sm:col-span-3">
                    <p className="text-xs text-muted-foreground">Face size</p>
                    <p className="font-medium">
                      {latestFaceSize != null
                        ? `${Math.round(latestFaceSize * 100)}% of frame`
                        : "Waiting for face"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={autoCapture ? "secondary" : "outline"}
                onClick={() => setAutoCapture((current) => !current)}
                disabled={saving}
              >
                Auto capture {autoCapture ? "on" : "off"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void captureSample()}
                disabled={
                  !cameraReady ||
                  !modelsReady ||
                  capturing ||
                  samples.length >= MAX_SAMPLES ||
                  saving
                }
              >
                {capturing
                  ? "Reading face..."
                  : "Capture now"}
              </Button>
              <Button
                type="button"
                onClick={() => void submitEnrollment()}
                disabled={samples.length < REQUIRED_SAMPLES || saving}
              >
                {saving ? "Saving..." : "Save enrollment"}
              </Button>
              {samples.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSamples([]);
                    setLastPreview(null);
                    setLiveFeedback("Samples cleared. Center one face.");
                  }}
                  disabled={saving}
                >
                  Reset samples
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                onClick={stopCamera}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void startCamera()}>
              {activeEnrollment ? "Re-enroll face" : "Enroll face"}
            </Button>
            {activeEnrollment ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void revokeActiveEnrollment()}
                disabled={saving}
              >
                Revoke enrollment
              </Button>
            ) : null}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold">Recent face attempts</p>
          {attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No face verification attempts yet.
            </p>
          ) : (
            <div className="space-y-2">
              {attempts.slice(0, 5).map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex flex-col gap-1 rounded-lg border bg-background/60 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {attempt.punchType || "Face check"} · {attempt.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(attempt.createdAt)}
                      {attempt.reason ? ` · ${attempt.reason}` : ""}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {attempt.distance != null
                      ? `Distance ${attempt.distance.toFixed(3)}`
                      : "No score"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
