"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { QrCode, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type KioskChallenge = {
  kioskId: string;
  nonce: string;
  exp: number;
  url: string;
};

const CHALLENGE_TTL_MS = 30_000;
const ROTATE_INTERVAL_MS = 30_000;

const getPublicBaseUrl = () => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return window.location.origin;
};

const makeChallenge = (kioskId: string, baseUrl: string): KioskChallenge => {
  const nonce = crypto.randomUUID();
  const exp = Date.now() + CHALLENGE_TTL_MS;
  const url = `${baseUrl}/employee/scan?k=${encodeURIComponent(
    kioskId,
  )}&n=${encodeURIComponent(nonce)}&e=${encodeURIComponent(String(exp))}`;
  return { kioskId, nonce, exp, url };
};

export function KioskQrPanel() {
  const kioskId = process.env.NEXT_PUBLIC_KIOSK_ID || "JC KIOSK";
  const [challenge, setChallenge] = useState<KioskChallenge | null>(() => {
    if (typeof window === "undefined") return null;
    return makeChallenge(kioskId, getPublicBaseUrl());
  });
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => {
      setChallenge(makeChallenge(kioskId, getPublicBaseUrl()));
    };
    const init = window.setTimeout(refresh, 0);
    const rotate = setInterval(() => {
      refresh();
    }, ROTATE_INTERVAL_MS);
    return () => {
      clearTimeout(init);
      clearInterval(rotate);
    };
  }, [kioskId]);

  useEffect(() => {
    if (!challenge) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((challenge.exp - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [challenge]);

  if (!challenge) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        Preparing kiosk QR...
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          <p className="text-sm font-medium">QR punch mode</p>
        </div>
        <Badge variant="outline">{kioskId}</Badge>
      </div>
      <div className="flex justify-center">
        <div className="rounded-lg bg-white p-3">
          <QRCode value={challenge.url} size={200} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Expires in {secondsLeft}s</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setChallenge(makeChallenge(kioskId, getPublicBaseUrl()))}
        >
          <RefreshCcw className="h-3 w-3" />
          Refresh QR
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Employees can scan this QR from their personal phone.
      </p>
    </div>
  );
}
