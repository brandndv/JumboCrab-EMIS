"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

type KioskChallenge = {
  kioskId: string;
  nonce: string;
  exp: number; // epoch ms
  url: string; // full URL encoded in QR
};

type EmployeePayload = {
  employeeId: string;
  employeeName: string;
  kioskId: string;
  nonce: string;
  exp: number;
  deviceId: string;
  ts: number;
};

function makeChallenge(kioskId: string): KioskChallenge {
  const nonce = crypto.randomUUID();
  const exp = Date.now() + 20_000; // valid for 20s
  const origin = window.location.origin;

  const url = `${origin}/employee/scan?k=${encodeURIComponent(
    kioskId
  )}&n=${encodeURIComponent(nonce)}&e=${encodeURIComponent(String(exp))}`;

  return { kioskId, nonce, exp, url };
}

function safeParseEmployeePayload(text: string): EmployeePayload | null {
  try {
    const obj = JSON.parse(text);
    if (
      !obj.employeeId ||
      !obj.employeeName ||
      !obj.kioskId ||
      !obj.nonce ||
      !obj.exp ||
      !obj.deviceId
    ) {
      return null;
    }
    return obj as EmployeePayload;
  } catch {
    return null;
  }
}

export default function KioskPage() {
  const kioskId = "KIOSK_001";

  const [challenge, setChallenge] = useState<KioskChallenge | null>(null);
  const [nowLeft, setNowLeft] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reader = useMemo(() => new BrowserMultiFormatReader(), []);

  const [message, setMessage] = useState<string>("Ready.");
  const [lastSuccess, setLastSuccess] = useState<any>(null);

  // Rotate kiosk QR every 15s
  useEffect(() => {
    setChallenge(makeChallenge(kioskId));

    const rotate = setInterval(() => {
      setChallenge(makeChallenge(kioskId));
    }, 15_000);

    return () => clearInterval(rotate);
  }, []);

  // Countdown
  useEffect(() => {
    if (!challenge) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((challenge.exp - Date.now()) / 1000));
      setNowLeft(left);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [challenge]);

  // Scan employee QR on kiosk
  useEffect(() => {
    let stopped = false;
    let controls: IScannerControls | null = null;

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;

        setMessage("Opening camera…");

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const preferred =
          devices.find((d) => /back|rear|environment/i.test(d.label))
            ?.deviceId ?? devices[0]?.deviceId;

        controls = await reader.decodeFromVideoDevice(
          preferred,
          video,
          async (result, _error) => {
            if (!result || stopped) return;

            const text = result.getText();
            const payload = safeParseEmployeePayload(text);
            if (!payload) {
              setMessage("Scanned QR is not a valid employee payload.");
              return;
            }

            // Optional: ensure employee payload was for this kiosk
            if (payload.kioskId !== kioskId) {
              setMessage("Wrong kioskId in employee QR.");
              return;
            }

            // Call demo API (no DB) to record punch state
            setMessage("Processing punch…");

            const res = await fetch("/api/demo/punch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok || !data.ok) {
              setMessage(`❌ Failed: ${data.error ?? "Unknown error"}`);
              return;
            }

            setLastSuccess(data);
            setMessage("✅ SUCCESS");
          }
        );
        if (stopped && controls) {
          controls.stop();
        }
      } catch (e: any) {
        setMessage(e?.message ?? "Camera error. Allow permission.");
        controls?.stop();
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [reader]);

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <h2>Kiosk</h2>

      {challenge && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ background: "white", padding: 16, borderRadius: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <b>Kiosk ID:</b> {kioskId}
            </div>
            <QRCode value={challenge.url} size={240} />
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
              Expires in: <b>{nowLeft}s</b>
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                wordBreak: "break-all",
                opacity: 0.7,
              }}
            >
              {challenge.url}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 280 }}>
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ddd",
                marginBottom: 12,
              }}
            >
              <b>Status:</b> {message}
              {lastSuccess && (
                <div style={{ marginTop: 8, lineHeight: 1.6 }}>
                  <div>
                    <b>Employee:</b> {lastSuccess.employeeName}
                  </div>
                  <div>
                    <b>Employee ID:</b> {lastSuccess.employeeId}
                  </div>
                  <div>
                    <b>Punch:</b> {lastSuccess.punch}
                  </div>
                  <div>
                    <b>Time:</b> {new Date(lastSuccess.at).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>

            <p style={{ marginBottom: 8 }}>Scan the employee QR here:</p>
            <video
              ref={videoRef}
              style={{ width: "100%", borderRadius: 12, background: "#000" }}
            />
            <p style={{ fontSize: 12, opacity: 0.75 }}>
              For real phones, use HTTPS so camera works.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
