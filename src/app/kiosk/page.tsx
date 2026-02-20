"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";

type KioskChallenge = {
  kioskId: string;
  nonce: string;
  exp: number; // epoch ms
  url: string; // full URL encoded in QR
};

type PunchResult = {
  employeeId: string;
  employeeName: string;
  kioskId: string;
  punch: "TIME_IN" | "TIME_OUT";
  at: number;
  historyCount: number;
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

export default function KioskPage() {
  const kioskId = "KIOSK_001";

  const [challenge, setChallenge] = useState<KioskChallenge | null>(null);
  const [nowLeft, setNowLeft] = useState<number>(0);
  const [message, setMessage] = useState<string>("Waiting for employee scan…");
  const [lastSuccess, setLastSuccess] = useState<PunchResult | null>(null);
  const lastAtRef = useRef<number | null>(null);

  const generateNewScan = () => {
    setChallenge(makeChallenge(kioskId));
    setLastSuccess(null);
    lastAtRef.current = null;
    setMessage("Waiting for employee scan…");
  };

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

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/demo/punch?kioskId=${kioskId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;

        if (res.ok && data?.ok) {
          if (lastAtRef.current !== data.at) {
            lastAtRef.current = data.at;
            setLastSuccess(data);
            setMessage("✅ SUCCESS");
          }
          return;
        }

        if (!lastAtRef.current) {
          setMessage("Waiting for employee scan…");
        }
      } catch {
        if (!lastAtRef.current) {
          setMessage("Waiting for employee scan…");
        }
      }
    };

    poll();
    const id = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [kioskId]);

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
                  <button onClick={generateNewScan} style={{ marginTop: 8 }}>
                    Generate new scan
                  </button>
                </div>
              )}
            </div>

            <p style={{ marginBottom: 8 }}>
              Employees scan the kiosk QR on their device. This screen updates
              automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
