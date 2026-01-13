"use client";

import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";

type KioskParsed = { kioskId: string; nonce: string; exp: number; raw: string };

function parseKioskQr(text: string): KioskParsed | null {
  try {
    // Supports absolute OR relative URLs
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

function getOrCreateDeviceId(): string {
  const KEY = "attendance_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export default function EmployeeScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reader = useMemo(() => new BrowserMultiFormatReader(), []);

  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");

  const [step, setStep] = useState<"FORM" | "SCANNING" | "SHOW_QR" | "ERROR">(
    "FORM"
  );
  const [error, setError] = useState("");
  const [kiosk, setKiosk] = useState<KioskParsed | null>(null);

  useEffect(() => {
    // load saved employee info for demo
    setEmployeeId(localStorage.getItem("demo_employee_id") ?? "");
    setEmployeeName(localStorage.getItem("demo_employee_name") ?? "");
  }, []);

  const startScan = () => {
    if (!employeeId.trim() || !employeeName.trim()) {
      setError("Please enter Employee ID and Name first.");
      return;
    }
    localStorage.setItem("demo_employee_id", employeeId.trim());
    localStorage.setItem("demo_employee_name", employeeName.trim());
    setError("");
    setStep("SCANNING");
  };

  useEffect(() => {
    if (step !== "SCANNING") return;

    let stopped = false;
    let controls: IScannerControls | null = null;

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const preferred =
          devices.find((d) => /back|rear|environment/i.test(d.label))
            ?.deviceId ?? devices[0]?.deviceId;

        controls = await reader.decodeFromVideoDevice(
          preferred,
          video,
          (result, _error, scannerControls) => {
            if (!result || stopped) return;

            const text = result.getText();
            const parsed = parseKioskQr(text);

            if (!parsed) {
              setError(
                "Invalid kiosk QR. Please scan the QR shown on the kiosk screen."
              );
              setStep("ERROR");
              stopped = true;
              scannerControls.stop();
              return;
            }

            if (Date.now() > parsed.exp) {
              setError("Kiosk QR expired. Please rescan (kiosk QR rotates).");
              setStep("ERROR");
              stopped = true;
              scannerControls.stop();
              return;
            }

            stopped = true;
            scannerControls.stop();
            setKiosk(parsed);
            setStep("SHOW_QR");
          }
        );
        if (stopped && controls) {
          controls.stop();
        }
      } catch (e: any) {
        setError(e?.message ?? "Camera error. Please allow permission.");
        setStep("ERROR");
        controls?.stop();
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [reader, step]);

  const reset = () => {
    setKiosk(null);
    setError("");
    setStep("FORM");
  };

  // Build employee payload QR (no DB)
  const deviceId =
    typeof window !== "undefined" ? getOrCreateDeviceId() : "unknown";
  const payload =
    kiosk &&
    JSON.stringify({
      employeeId: employeeId.trim(),
      employeeName: employeeName.trim(),
      kioskId: kiosk.kioskId,
      nonce: kiosk.nonce,
      exp: kiosk.exp,
      deviceId,
      ts: Date.now(),
    });

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <h2>Employee</h2>

      {step === "FORM" && (
        <>
          <p>Enter your details (demo only), then scan the kiosk QR.</p>

          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Employee ID"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />
            <input
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Employee Name"
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />
            {error && <p style={{ color: "crimson" }}>{error}</p>}
            <button
              onClick={startScan}
              style={{ padding: 10, borderRadius: 8 }}
            >
              Start scanning kiosk QR
            </button>
          </div>
        </>
      )}

      {step === "SCANNING" && (
        <>
          <p>Point your camera at the kiosk QR code.</p>
          <video
            ref={videoRef}
            style={{ width: "100%", borderRadius: 12, background: "#000" }}
          />
          <p style={{ fontSize: 12, opacity: 0.75 }}>
            If camera doesn’t open, check permissions and use HTTPS on real
            devices.
          </p>
        </>
      )}

      {step === "SHOW_QR" && kiosk && payload && (
        <>
          <p>Show this QR to the kiosk scanner.</p>

          <div
            style={{
              background: "white",
              padding: 16,
              borderRadius: 12,
              width: 300,
            }}
          >
            <QRCode value={payload} size={260} />
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            <div>
              <b>Kiosk:</b> {kiosk.kioskId}
            </div>
            <div>
              <b>Expires:</b> {new Date(kiosk.exp).toLocaleTimeString()}
            </div>
            <div>
              <b>DeviceId:</b> {deviceId}
            </div>
          </div>

          <button onClick={reset} style={{ marginTop: 12 }}>
            Done / Scan again
          </button>
        </>
      )}

      {step === "ERROR" && (
        <>
          <p style={{ color: "crimson" }}>{error}</p>
          <button onClick={reset}>Back</button>
        </>
      )}
    </div>
  );
}
