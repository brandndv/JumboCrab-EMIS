"use client";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

const DynamicQr = () => {
  const [qrValue, setQrValue] = useState("");

  useEffect(() => {
    const makeValue = () => {
      // Put your real payload here (kioskId + timestamp + nonce, etc.)
      const kioskId = "KIOSK_001";
      const ts = Date.now();
      const nonce = crypto.randomUUID(); // browser-supported in modern browsers
      return JSON.stringify({ kioskId, ts, nonce });
    };

    setQrValue(makeValue());

    const id = setInterval(() => {
      setQrValue(makeValue());
    }, 5_000); // 1 minute

    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: "white", padding: 16, width: 256 }}>
      <QRCode value={qrValue} size={220} />
      <div style={{ marginTop: 8, fontSize: 12, wordBreak: "break-all" }}>
        {qrValue}
      </div>
    </div>
  );
};

export default DynamicQr;
