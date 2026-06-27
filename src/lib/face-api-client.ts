"use client";

export const FACE_API_MODEL_VERSION =
  "face-api.js@0.22.2/tiny-face-detector+face-landmark-68+face-recognition";

export const FACE_API_LIVENESS_PROMPTS = [
  "Blink twice",
  "Turn your head left",
  "Turn your head right",
] as const;

export const FRONT_FACE_LIVENESS_PROMPT = "Face camera directly" as const;
export const FRONT_FACE_BLINK_LIVENESS_PROMPT =
  "Face camera directly and blink" as const;

export type FaceApiLivenessPrompt =
  | (typeof FACE_API_LIVENESS_PROMPTS)[number]
  | typeof FRONT_FACE_LIVENESS_PROMPT
  | typeof FRONT_FACE_BLINK_LIVENESS_PROMPT;

export type FaceApiDescriptorMetadata = {
  detectionScore: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  inputWidth: number;
  inputHeight: number;
  faceBoxRatio: number;
  eyeAspectRatio: number | null;
  yawRatio: number | null;
};

export type FaceApiDescriptorResult = {
  descriptor: number[];
  faceCount: 1;
  modelVersion: string;
  metadata: FaceApiDescriptorMetadata;
};

export type FaceApiVerificationPayload = {
  descriptor: number[] | null;
  faceCount: number;
  livenessPassed: boolean;
  livenessPrompt: FaceApiLivenessPrompt;
  modelVersion: string;
  metadata: {
    validFrames: number;
    totalFrames: number;
    elapsedMs: number;
    detectionScore?: number;
    faceBoxRatio?: number;
    eyeAspectRatioMin?: number;
    eyeAspectRatioMax?: number;
    yawRatioMin?: number;
    yawRatioMax?: number;
    frontFaceOnly?: boolean;
    blinkRequired?: boolean;
  };
};

type PointLike = { x: number; y: number };
type FaceInput = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
type FaceApiModule = typeof import("face-api.js");
type FaceApiDetectionResult = import("face-api.js").WithFaceDescriptor<
  import("face-api.js").WithFaceLandmarks<import("face-api.js").WithFaceDetection<object>>
>;

export class FaceApiClientError extends Error {
  reason: string;
  faceCount: number;

  constructor(message: string, reason: string, faceCount: number) {
    super(message);
    this.name = "FaceApiClientError";
    this.reason = reason;
    this.faceCount = faceCount;
  }
}

let modelsPromise: Promise<void> | null = null;
let faceApiModulePromise: Promise<FaceApiModule> | null = null;

const modelUrl = "/models/face-api";
const getFaceApi = async (): Promise<FaceApiModule> => {
  if (typeof window === "undefined") {
    throw new Error("face-api.js can only load in the browser.");
  }

  if (!faceApiModulePromise) {
    faceApiModulePromise = import("face-api.js").catch((error) => {
      faceApiModulePromise = null;
      throw error;
    });
  }

  return faceApiModulePromise;
};

const detectorOptions = (faceapi: FaceApiModule) =>
  new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.45,
  });

const FRONT_FACE_MIN_DETECTION_SCORE = 0.55;
const FRONT_FACE_MIN_BOX_RATIO = 0.16;
const FRONT_FACE_MAX_BOX_RATIO = 0.72;
const FRONT_FACE_MAX_ABS_YAW_RATIO = 0.1;
const BLINK_MIN_SAMPLE_COUNT = 6;
const BLINK_MIN_EYE_RATIO_DELTA = 0.025;
const BLINK_MIN_RELATIVE_DROP = 0.12;
const LIVE_FRONT_FACE_SAMPLE_COUNT = 18;
const LIVE_FRONT_FACE_SAMPLE_DELAY_MS = 70;

const delay = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const distance = (a: PointLike, b: PointLike) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const center = (points: PointLike[]) => {
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  return {
    x: total.x / Math.max(1, points.length),
    y: total.y / Math.max(1, points.length),
  };
};

const eyeAspectRatio = (eye: PointLike[]) => {
  if (eye.length < 6) return null;
  const horizontal = distance(eye[0], eye[3]);
  if (horizontal <= 0) return null;
  const vertical =
    (distance(eye[1], eye[5]) + distance(eye[2], eye[4])) / 2;
  return vertical / horizontal;
};

const average = (values: number[]) => {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const inputDimensions = (input: FaceInput) => {
  if (input instanceof HTMLVideoElement) {
    return {
      width: input.videoWidth || input.clientWidth || 1,
      height: input.videoHeight || input.clientHeight || 1,
    };
  }

  if (input instanceof HTMLImageElement) {
    return {
      width: input.naturalWidth || input.width || 1,
      height: input.naturalHeight || input.height || 1,
    };
  }

  return {
    width: input.width || 1,
    height: input.height || 1,
  };
};

const averageDescriptors = (descriptors: number[][]) => {
  if (descriptors.length === 0) return null;
  const length = descriptors[0]?.length ?? 0;
  if (length === 0 || descriptors.some((descriptor) => descriptor.length !== length)) {
    return null;
  }

  return Array.from({ length }, (_, index) =>
    average(descriptors.map((descriptor) => descriptor[index])) ?? 0,
  );
};

const summarizeLandmarks = (
  landmarks: import("face-api.js").FaceLandmarks68,
  input: FaceInput,
) => {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const nose = landmarks.getNose();
  const leftCenter = center(leftEye);
  const rightCenter = center(rightEye);
  const eyeDistance = distance(leftCenter, rightCenter);
  const eyeMidpoint = center([leftCenter, rightCenter]);
  const noseTip = nose[3] ?? nose[nose.length - 1] ?? eyeMidpoint;

  const leftEar = eyeAspectRatio(leftEye);
  const rightEar = eyeAspectRatio(rightEye);
  const earValues = [leftEar, rightEar].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  const { width } = inputDimensions(input);
  const yawDenominator = eyeDistance > 0 ? eyeDistance : width;

  return {
    eyeAspectRatio: average(earValues),
    yawRatio:
      yawDenominator > 0 ? (noseTip.x - eyeMidpoint.x) / yawDenominator : null,
  };
};

const metadataFromDetection = (
  result: FaceApiDetectionResult,
  input: FaceInput,
): FaceApiDescriptorMetadata => {
  const { width: inputWidth, height: inputHeight } = inputDimensions(input);
  const box = result.detection.box;
  const landmarks = summarizeLandmarks(result.landmarks, input);

  return {
    detectionScore: result.detection.score,
    box: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    },
    inputWidth,
    inputHeight,
    faceBoxRatio: Math.min(box.width / inputWidth, box.height / inputHeight),
    eyeAspectRatio: landmarks.eyeAspectRatio,
    yawRatio: landmarks.yawRatio,
  };
};

const compactMetadata = (samples: FaceApiDescriptorResult[]) => {
  const ears = samples
    .map((sample) => sample.metadata.eyeAspectRatio)
    .filter((value): value is number => typeof value === "number");
  const yaws = samples
    .map((sample) => sample.metadata.yawRatio)
    .filter((value): value is number => typeof value === "number");
  const scores = samples.map((sample) => sample.metadata.detectionScore);
  const boxRatios = samples.map((sample) => sample.metadata.faceBoxRatio);

  return {
    detectionScore: average(scores) ?? undefined,
    faceBoxRatio: average(boxRatios) ?? undefined,
    eyeAspectRatioMin: ears.length ? Math.min(...ears) : undefined,
    eyeAspectRatioMax: ears.length ? Math.max(...ears) : undefined,
    yawRatioMin: yaws.length ? Math.min(...yaws) : undefined,
    yawRatioMax: yaws.length ? Math.max(...yaws) : undefined,
  };
};

const evaluateLiveness = (
  prompt: FaceApiLivenessPrompt,
  samples: FaceApiDescriptorResult[],
) => {
  if (prompt === FRONT_FACE_LIVENESS_PROMPT) {
    return samples.every((sample) => getFrontFaceSampleIssue(sample) === null);
  }

  const metadata = compactMetadata(samples);
  const earMin = metadata.eyeAspectRatioMin;
  const earMax = metadata.eyeAspectRatioMax;
  const yawMin = metadata.yawRatioMin;
  const yawMax = metadata.yawRatioMax;

  if (prompt === "Blink twice") {
    if (earMin == null || earMax == null) return false;
    return earMin < 0.22 && earMax - earMin > 0.045;
  }

  if (yawMin == null || yawMax == null) return false;
  const strongestTurn = Math.max(Math.abs(yawMin), Math.abs(yawMax));

  if (prompt === "Turn your head left") {
    return yawMax > 0.08 || strongestTurn > 0.14;
  }

  return yawMin < -0.08 || strongestTurn > 0.14;
};

export const livenessInstructionText = (prompt: FaceApiLivenessPrompt) => {
  switch (prompt) {
    case FRONT_FACE_LIVENESS_PROMPT:
      return "FACE CAMERA DIRECTLY";
    case FRONT_FACE_BLINK_LIVENESS_PROMPT:
      return "FACE CAMERA AND BLINK ONCE";
    case "Blink twice":
      return "BLINK TWICE NOW";
    case "Turn your head left":
      return "TURN HEAD LEFT";
    case "Turn your head right":
      return "TURN HEAD RIGHT";
  }
};

const getFrontFaceSampleIssue = (sample: FaceApiDescriptorResult) => {
  const { detectionScore, faceBoxRatio, yawRatio } = sample.metadata;

  if (detectionScore < FRONT_FACE_MIN_DETECTION_SCORE) {
    return {
      reason: "weak_detection",
      message: "Need brighter light. Face camera directly.",
    };
  }

  if (faceBoxRatio < FRONT_FACE_MIN_BOX_RATIO) {
    return {
      reason: "face_too_small",
      message: "Move closer to the camera.",
    };
  }

  if (faceBoxRatio > FRONT_FACE_MAX_BOX_RATIO) {
    return {
      reason: "face_too_close",
      message: "Move back a little.",
    };
  }

  if (yawRatio == null || Math.abs(yawRatio) > FRONT_FACE_MAX_ABS_YAW_RATIO) {
    return {
      reason: "face_not_front",
      message: "Face camera directly. No left or right turn.",
    };
  }

  return null;
};

const hasBlinkMotion = (samples: FaceApiDescriptorResult[]) => {
  const ears = samples
    .map((sample) => sample.metadata.eyeAspectRatio)
    .filter((value): value is number => typeof value === "number");

  if (ears.length < BLINK_MIN_SAMPLE_COUNT) return false;

  const earMin = Math.min(...ears);
  const earMax = Math.max(...ears);
  if (earMax <= 0) return false;

  const delta = earMax - earMin;
  const relativeDrop = delta / earMax;

  return (
    delta >= BLINK_MIN_EYE_RATIO_DELTA &&
    relativeDrop >= BLINK_MIN_RELATIVE_DROP
  );
};

export const loadFaceApiModels = async () => {
  if (!modelsPromise) {
    const faceapi = await getFaceApi();

    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
    ])
      .then(async () => {
        await faceapi.tf.ready();
      })
      .catch((error) => {
        modelsPromise = null;
        throw error;
      });
  }

  return modelsPromise;
};

export const captureFaceDescriptor = async (
  input: FaceInput,
): Promise<FaceApiDescriptorResult> => {
  await loadFaceApiModels();
  const faceapi = await getFaceApi();

  const detections = await faceapi
    .detectAllFaces(input, detectorOptions(faceapi))
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length === 0) {
    throw new FaceApiClientError(
      "No face detected. Center one face in the camera.",
      "no_face_detected",
      0,
    );
  }

  if (detections.length > 1) {
    throw new FaceApiClientError(
      "Multiple faces detected. Keep only one employee in frame.",
      "multiple_faces",
      detections.length,
    );
  }

  return {
    descriptor: Array.from(detections[0].descriptor),
    faceCount: 1,
    modelVersion: FACE_API_MODEL_VERSION,
    metadata: metadataFromDetection(detections[0], input),
  };
};

export const captureFaceVerificationPayload = async (
  video: HTMLVideoElement,
  prompt: FaceApiLivenessPrompt,
): Promise<FaceApiVerificationPayload> => {
  const startedAt = performance.now();
  const samples: FaceApiDescriptorResult[] = [];
  let faceCount = 0;

  for (let index = 0; index < 8; index += 1) {
    try {
      const sample = await captureFaceDescriptor(video);
      samples.push(sample);
      faceCount = 1;
    } catch (error) {
      if (error instanceof FaceApiClientError) {
        faceCount = Math.max(faceCount, error.faceCount);
        if (error.reason === "multiple_faces") break;
      } else {
        throw error;
      }
    }
    await delay(160);
  }

  const descriptor = averageDescriptors(samples.map((sample) => sample.descriptor));
  const livenessPassed =
    faceCount === 1 && samples.length >= 3 && evaluateLiveness(prompt, samples);
  const metadata = compactMetadata(samples);

  return {
    descriptor,
    faceCount: descriptor ? 1 : faceCount,
    livenessPassed,
    livenessPrompt: prompt,
    modelVersion: FACE_API_MODEL_VERSION,
    metadata: {
      validFrames: samples.length,
      totalFrames: 8,
      elapsedMs: Math.round(performance.now() - startedAt),
      ...metadata,
    },
  };
};

export const captureFrontFaceVerificationPayload = async (
  video: HTMLVideoElement,
): Promise<FaceApiVerificationPayload> => {
  const startedAt = performance.now();
  const samples: FaceApiDescriptorResult[] = [];
  let faceCount = 0;

  for (let index = 0; index < 3; index += 1) {
    const sample = await captureFaceDescriptor(video);
    faceCount = sample.faceCount;

    const issue = getFrontFaceSampleIssue(sample);
    if (issue) {
      throw new FaceApiClientError(issue.message, issue.reason, faceCount);
    }

    samples.push(sample);

    if (index < 2) {
      await delay(70);
    }
  }

  const descriptor = averageDescriptors(samples.map((sample) => sample.descriptor));
  if (!descriptor) {
    throw new FaceApiClientError(
      "Face descriptor is required before punching.",
      "missing_face_descriptor",
      faceCount,
    );
  }

  const metadata = compactMetadata(samples);

  return {
    descriptor,
    faceCount: 1,
    livenessPassed: true,
    livenessPrompt: FRONT_FACE_LIVENESS_PROMPT,
    modelVersion: FACE_API_MODEL_VERSION,
    metadata: {
      validFrames: samples.length,
      totalFrames: 3,
      elapsedMs: Math.round(performance.now() - startedAt),
      frontFaceOnly: true,
      ...metadata,
    },
  };
};

export const captureLiveFrontFaceVerificationPayload = async (
  video: HTMLVideoElement,
): Promise<FaceApiVerificationPayload> => {
  const startedAt = performance.now();
  const samples: FaceApiDescriptorResult[] = [];
  let faceCount = 0;

  for (let index = 0; index < LIVE_FRONT_FACE_SAMPLE_COUNT; index += 1) {
    const sample = await captureFaceDescriptor(video);
    faceCount = sample.faceCount;

    const issue = getFrontFaceSampleIssue(sample);
    if (issue) {
      throw new FaceApiClientError(issue.message, issue.reason, faceCount);
    }

    samples.push(sample);

    if (index < LIVE_FRONT_FACE_SAMPLE_COUNT - 1) {
      await delay(LIVE_FRONT_FACE_SAMPLE_DELAY_MS);
    }
  }

  if (!hasBlinkMotion(samples)) {
    throw new FaceApiClientError(
      "Blink slowly once to verify live face.",
      "blink_required",
      faceCount,
    );
  }

  const descriptor = averageDescriptors(samples.map((sample) => sample.descriptor));
  if (!descriptor) {
    throw new FaceApiClientError(
      "Face descriptor is required before punching.",
      "missing_face_descriptor",
      faceCount,
    );
  }

  const metadata = compactMetadata(samples);

  return {
    descriptor,
    faceCount: 1,
    livenessPassed: true,
    livenessPrompt: FRONT_FACE_BLINK_LIVENESS_PROMPT,
    modelVersion: FACE_API_MODEL_VERSION,
    metadata: {
      validFrames: samples.length,
      totalFrames: LIVE_FRONT_FACE_SAMPLE_COUNT,
      elapsedMs: Math.round(performance.now() - startedAt),
      frontFaceOnly: true,
      blinkRequired: true,
      ...metadata,
    },
  };
};
