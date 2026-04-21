"use client";

import * as faceapi from "face-api.js";

export const FACE_API_MODEL_VERSION =
  "face-api.js@0.22.2/tiny-face-detector+face-landmark-68+face-recognition";

export const FACE_API_LIVENESS_PROMPTS = [
  "Blink twice",
  "Turn your head left",
  "Turn your head right",
] as const;

export type FaceApiLivenessPrompt = (typeof FACE_API_LIVENESS_PROMPTS)[number];

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
  };
};

type PointLike = { x: number; y: number };
type FaceInput = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

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

const modelUrl = "/models/face-api";
const detectorOptions = () =>
  new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.45,
  });

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
  landmarks: faceapi.FaceLandmarks68,
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
  result: faceapi.WithFaceDescriptor<
    faceapi.WithFaceLandmarks<faceapi.WithFaceDetection<object>>
  >,
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
    case "Blink twice":
      return "BLINK TWICE NOW";
    case "Turn your head left":
      return "TURN HEAD LEFT";
    case "Turn your head right":
      return "TURN HEAD RIGHT";
  }
};

export const loadFaceApiModels = async () => {
  if (!modelsPromise) {
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

  const detections = await faceapi
    .detectAllFaces(input, detectorOptions())
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
