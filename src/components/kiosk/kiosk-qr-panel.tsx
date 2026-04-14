"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { QrCode, RefreshCcw } from "lucide-react";
import { consumeKioskQrScanAcknowledgement } from "@/actions/attendance/kiosk-attendance-action";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type KioskChallenge = {
  kioskId: string;
  nonce: string;
  exp: number;
  url: string;
};

type KioskQrAcknowledgement = {
  kioskId: string;
  nonce: string;
  exp: number;
  username: string;
  employeeName: string;
  employeeCode: string;
  punchType: string;
  punchTime: string;
  acknowledgedAt: number;
};

const getPublicBaseUrl = () => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return window.location.origin;
};

const makeChallenge = (
  kioskId: string,
  baseUrl: string,
  exp: number,
): KioskChallenge => {
  const nonce = crypto.randomUUID();
  const url = `${baseUrl}/employee/scan?k=${encodeURIComponent(
    kioskId,
  )}&n=${encodeURIComponent(nonce)}&e=${encodeURIComponent(String(exp))}`;
  return { kioskId, nonce, exp, url };
};

type KioskQrPanelProps = {
  active: boolean;
  sessionSecondsLeft: number;
  activeUntil: number | null;
  onScanSuccess: (ack: KioskQrAcknowledgement) => void;
};

export function KioskQrPanel({
  active,
  sessionSecondsLeft,
  activeUntil,
  onScanSuccess,
}: KioskQrPanelProps) {
  const kioskId = process.env.NEXT_PUBLIC_KIOSK_ID || "JC KIOSK";
  const [challenge, setChallenge] = useState<KioskChallenge | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (!activeUntil) return;

    if (typeof window === "undefined") return;
    const refresh = () => {
      setChallenge(makeChallenge(kioskId, getPublicBaseUrl(), activeUntil));
    };
    const init = window.setTimeout(refresh, 0);
    return () => {
      clearTimeout(init);
    };
  }, [active, activeUntil, kioskId]);

  useEffect(() => {
    if (!active || !challenge) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((challenge.exp - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [active, challenge]);

  useEffect(() => {
    if (!active || !challenge) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const result = await consumeKioskQrScanAcknowledgement({
          kioskId: challenge.kioskId,
          nonce: challenge.nonce,
          exp: challenge.exp,
        });

        if (cancelled || !result.success || !result.data) {
          return;
        }

        onScanSuccess(result.data);
      } catch {
        // Ignore transient polling failures; the next poll can recover.
      }
    };

    const interval = window.setInterval(() => {
      void poll();
    }, 1000);

    void poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active, challenge, onScanSuccess]);

  if (!active) {
    return (
      <div className="space-y-4 rounded-[28px] border border-dashed border-slate-800 bg-slate-950/40 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-slate-400">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">QR hidden</p>
            <p className="text-xs text-slate-400">
              Press Show QR to generate a fresh scan challenge.
            </p>
          </div>
        </div>
        <p className="text-xs leading-6 text-slate-500">
          Keeping the QR hidden reduces the time that a reusable challenge stays
          exposed on the kiosk.
        </p>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-sm text-slate-400">
        Preparing kiosk QR...
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-[28px] border border-slate-800 bg-slate-950/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/12 text-orange-300">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">
              QR punch mode
            </p>
            <p className="text-xs text-slate-400">
              Scan this rotating code from the employee phone.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-slate-700 bg-slate-900 text-slate-200"
        >
          {kioskId}
        </Badge>
      </div>
      <div className="flex justify-center">
        <div className="rounded-[28px] bg-white p-5 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.8)]">
          <QRCode value={challenge.url} size={240} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
        <span>
          Expires in {secondsLeft}s · Closes in {sessionSecondsLeft}s
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 rounded-xl px-3 text-xs text-slate-300 hover:bg-slate-900 hover:text-slate-100"
          onClick={() =>
            activeUntil
              ? setChallenge(makeChallenge(kioskId, getPublicBaseUrl(), activeUntil))
              : undefined
          }
        >
          <RefreshCcw className="h-3 w-3" />
          Refresh QR
        </Button>
      </div>
      <p className="text-xs leading-6 text-slate-400">
        Employees should scan this QR from their personal phone. The challenge
        closes after this session or immediately after a successful scan.
      </p>
    </div>
  );
}
