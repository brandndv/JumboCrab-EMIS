export const ATTENDANCE_DEVICE_TOKEN_STORAGE_KEY =
  "jumbocrab_attendance_device_token";

const fallbackRandomToken = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const toBase64 = (value: string) => {
  try {
    const bytes = new TextEncoder().encode(value);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return window.btoa(binary);
  } catch {
    return value;
  }
};

const sha256Hex = async (value: string) => {
  if (!window.crypto?.subtle) {
    return toBase64(value).slice(0, 64);
  }

  const encoded = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((chunk) => chunk.toString(16).padStart(2, "0"))
    .join("");
};

export const getOrCreateAttendanceDeviceToken = async (enabled: boolean) => {
  if (!enabled || typeof window === "undefined") return null;

  const existing = window.localStorage.getItem(ATTENDANCE_DEVICE_TOKEN_STORAGE_KEY);
  if (existing) return existing;

  const nextToken =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : fallbackRandomToken();

  window.localStorage.setItem(ATTENDANCE_DEVICE_TOKEN_STORAGE_KEY, nextToken);
  return nextToken;
};

export const buildAttendanceFingerprint = async (enabled: boolean) => {
  if (!enabled || typeof window === "undefined") return null;

  const screenInfo =
    typeof window.screen !== "undefined"
      ? `${window.screen.width}x${window.screen.height}:${window.screen.colorDepth}`
      : "screen:unknown";

  const parts = [
    navigator.userAgent || "ua:unknown",
    navigator.language || "lang:unknown",
    navigator.platform || "platform:unknown",
    Intl.DateTimeFormat().resolvedOptions().timeZone || "tz:unknown",
    screenInfo,
    `hc:${navigator.hardwareConcurrency ?? "unknown"}`,
    `dm:${(navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? "unknown"}`,
    `touch:${navigator.maxTouchPoints ?? 0}`,
    `dpr:${window.devicePixelRatio ?? 1}`,
  ];

  return sha256Hex(parts.join("|"));
};

export const collectAttendanceLocation = async (enabled: boolean) => {
  if (!enabled || typeof window === "undefined" || !navigator.geolocation) {
    return { latitude: null, longitude: null };
  }

  return new Promise<{ latitude: number | null; longitude: number | null }>(
    (resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          resolve({ latitude: null, longitude: null });
        },
        {
          enableHighAccuracy: false,
          timeout: 7000,
          maximumAge: 60_000,
        },
      );
    },
  );
};

export const collectAttendanceDeviceContext = async (config: {
  deviceTokenTrackingEnabled: boolean;
  fingerprintTrackingEnabled: boolean;
  gpsValidationEnabled: boolean;
}) => {
  const [deviceToken, fingerprint, location] = await Promise.all([
    getOrCreateAttendanceDeviceToken(config.deviceTokenTrackingEnabled),
    buildAttendanceFingerprint(config.fingerprintTrackingEnabled),
    collectAttendanceLocation(config.gpsValidationEnabled),
  ]);

  return {
    deviceToken,
    fingerprint,
    latitude: location.latitude,
    longitude: location.longitude,
  };
};
