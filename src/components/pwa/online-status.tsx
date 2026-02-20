"use client";

import { useEffect, useState } from "react";

export function OnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(window.navigator.onLine);
    };

    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 rounded-md border border-border bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground shadow-lg">
      Offline: live updates are unavailable.
    </div>
  );
}
