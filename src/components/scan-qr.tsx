"use client";

import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import { useEffect, useMemo, useRef, useState } from "react";

type Parsed = {
  kioskId: string;
  nonce: string;
  exp?: number; // epoch ms
  raw: string;
};

type DeviceInfo = {
  deviceId: string; // persistent per browser (localStorage)
  userAgent: string;
  platform?: string;
  vendor?: string;
  language: string;
  timezone: string;
  screen: string;
  dpr: number;
  cores?: number;
  memoryGb?: number;
  touchPoints?: number;
  online: boolean;
  connection?: string; // best-effort network summary
};

function parseKioskQr(text: string): Parsed | null {
  try {
    // Supports absolute OR relative URLs (recommended)
    // Example: /employee/scan?k=K1&n=UUID&e=1730000000000
    if (text.includes("?")) {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost";
      const url = new URL(text, origin);

      const kioskId = url.searchParams.get("k") ?? "";
      const nonce = url.searchParams.get("n") ?? "";
      const e = url.searchParams.get("e");
      const exp = e ? Number(e) : undefined;

      if (!kioskId || !nonce) return null;
      return { kioskId, nonce, exp, raw: text };
    }

    // JSON fallback:
    // {"kioskId":"...","nonce":"...","exp":123}
    const obj = JSON.parse(text);
    const kioskId = obj.kioskId ?? obj.k ?? "";
    const nonce = obj.nonce ?? obj.n ?? "";
    const exp = typeof obj.exp === "number" ? obj.exp : undefined;

    if (!kioskId || !nonce) return null;
    return { kioskId, nonce, exp, raw: text };
  } catch {
    return null;
  }
}

function getOrCreateDeviceId(): string {
  const KEY = "attendance_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

function getConnectionSummary(): string | undefined {
  const c = (navigator as any).connection;
  if (!c) return undefined;

  const parts = [
    c.effectiveType, // e.g., "4g"
    typeof c.downlink === "number" ? `${c.downlink}Mb/s` : null,
    typeof c.rtt === "number" ? `${c.rtt}ms` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" ") : undefined;
}

function collectDeviceInfo(): DeviceInfo {
  return {
    deviceId: getOrCreateDeviceId(),
    userAgent: navigator.userAgent,
    platform: (navigator as any).userAgentData?.platform ?? navigator.platform,
    vendor: navigator.vendor,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}`,
    dpr: window.devicePixelRatio,
    cores: navigator.hardwareConcurrency,
    memoryGb: (navigator as any).deviceMemory, // Chrome-only
    touchPoints: navigator.maxTouchPoints,
    online: navigator.onLine,
    connection: getConnectionSummary(),
  };
}

async function sha256Hex(text: string): Promise<string> {
  // Best-effort: crypto.subtle requires HTTPS in production.
  try {
    if (!crypto?.subtle) throw new Error("crypto.subtle not available");
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(hash)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // Fallback (non-crypto) short hash so you still see "something unique-ish"
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
}

export default function ScanQrNow() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reader = useMemo(() => new BrowserMultiFormatReader(), []);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scannedOnceRef = useRef(false);

  const [status, setStatus] = useState<"SCANNING" | "SCANNED" | "ERROR">(
    "SCANNING"
  );
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [isExpired, setIsExpired] = useState<boolean | null>(null);

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>("");

  useEffect(() => {
    if (status !== "SCANNING") return;

    scannedOnceRef.current = false;
    setError("");

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;

        // Stop any previous scanner instance
        controlsRef.current?.stop();
        controlsRef.current = null;

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();

        // Try to prefer rear camera (labels may be blank until permission on some browsers)
        const preferredDeviceId =
          devices.find((d) => /back|rear|environment/i.test(d.label))
            ?.deviceId ?? devices[0]?.deviceId;

        controlsRef.current = await reader.decodeFromVideoDevice(
          preferredDeviceId,
          video,
          async (result) => {
            if (!result) return;
            if (scannedOnceRef.current) return;

            scannedOnceRef.current = true;

            const text = result.getText();
            const data = parseKioskQr(text);

            if (!data) {
              setError("Invalid QR format. Please scan the kiosk QR.");
              setStatus("ERROR");
              controlsRef.current?.stop();
              return;
            }

            const expired = data.exp ? Date.now() > data.exp : false;

            setParsed(data);
            setIsExpired(expired);
            setStatus("SCANNED");

            // Collect device info + fingerprint (best-effort)
            const dev = collectDeviceInfo();
            setDeviceInfo(dev);

            const fp = await sha256Hex(JSON.stringify(dev));
            const shortFp = fp.length > 16 ? fp.slice(0, 16) : fp;
            setDeviceFingerprint(shortFp);

            // POP-OUT (quick confirmation)
            alert(
              `SCANNED ✅\n` +
                `Kiosk: ${data.kioskId}\n` +
                `Nonce: ${data.nonce}\n` +
                `Exp: ${data.exp ?? "none"}\n` +
                `Status: ${expired ? "EXPIRED" : "VALID"}\n\n` +
                `Unique Device ID: ${dev.deviceId}\n` +
                `Fingerprint: ${shortFp}\n` +
                `Platform: ${dev.platform ?? "n/a"}\n` +
                `Screen: ${dev.screen} @${dev.dpr}x\n` +
                `Lang/TZ: ${dev.language} / ${dev.timezone}\n` +
                `Online: ${dev.online}\n` +
                `Conn: ${dev.connection ?? "n/a"}`
            );

            controlsRef.current?.stop();
          }
        );
      } catch (e: any) {
        setError(e?.message ?? "Camera error. Please allow camera permission.");
        setStatus("ERROR");
        controlsRef.current?.stop();
      }
    })();

    return () => {
      controlsRef.current?.stop();
    };
  }, [reader, status]);

  const scanAgain = () => {
    controlsRef.current?.stop();
    scannedOnceRef.current = false;

    setParsed(null);
    setIsExpired(null);
    setDeviceInfo(null);
    setDeviceFingerprint("");
    setError("");
    setStatus("SCANNING");
  };

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <h2>Employee Scan</h2>

      {status === "SCANNING" && (
        <>
          <p>Point your camera at the kiosk QR code.</p>
          <video
            ref={videoRef}
            style={{ width: "100%", borderRadius: 12, background: "#000" }}
          />
          <p style={{ fontSize: 12, opacity: 0.75 }}>
            Tip: In production, camera access works best on HTTPS.
          </p>
        </>
      )}

      {status === "SCANNED" && parsed && (
        <>
          <p>
            Scan result:{" "}
            <b style={{ color: isExpired ? "crimson" : "green" }}>
              {isExpired ? "EXPIRED" : "VALID"}
            </b>
          </p>

          <div
            style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}
          >
            <div>
              <b>Kiosk ID:</b> {parsed.kioskId}
            </div>
            <div>
              <b>Nonce:</b> {parsed.nonce}
            </div>
            <div>
              <b>Expiry (ms):</b> {parsed.exp ?? "Not provided"}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                wordBreak: "break-all",
                opacity: 0.8,
              }}
            >
              <b>Raw:</b> {parsed.raw}
            </div>
          </div>

          {deviceInfo && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 12,
              }}
            >
              <div>
                <b>Unique Device ID:</b> {deviceInfo.deviceId}
              </div>
              <div>
                <b>Fingerprint:</b> {deviceFingerprint || "computing..."}
              </div>
              <div>
                <b>Platform:</b> {deviceInfo.platform ?? "n/a"}
              </div>
              <div>
                <b>Screen:</b> {deviceInfo.screen} @{deviceInfo.dpr}x
              </div>
              <div>
                <b>Language / Timezone:</b> {deviceInfo.language} /{" "}
                {deviceInfo.timezone}
              </div>
              <div>
                <b>Online:</b> {String(deviceInfo.online)}
              </div>
              <div>
                <b>Connection:</b> {deviceInfo.connection ?? "n/a"}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                <b>User Agent:</b>{" "}
                <span style={{ wordBreak: "break-all" }}>
                  {deviceInfo.userAgent}
                </span>
              </div>
            </div>
          )}

          <button onClick={scanAgain} style={{ marginTop: 12 }}>
            Scan again
          </button>
        </>
      )}

      {status === "ERROR" && (
        <>
          <p style={{ color: "crimson" }}>{error}</p>
          <button onClick={scanAgain}>Try again</button>
        </>
      )}
    </div>
  );
}
