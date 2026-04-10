"use client";

import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Prevent stale production SW/caches from breaking local dev.
      const DEV_SW_RESET_KEY = "dev-sw-reset-v1";

      Promise.all([
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(
              registrations.map((registration) => registration.unregister()),
            ).then(() => registrations),
          ),
        "caches" in window
          ? caches
              .keys()
              .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          : Promise.resolve([]),
      ])
        .then(([registrations]) => {
          const hadController = Boolean(navigator.serviceWorker.controller);
          const hadRegistrations = registrations.length > 0;

          if (!(hadController || hadRegistrations)) {
            sessionStorage.removeItem(DEV_SW_RESET_KEY);
            return;
          }

          if (!sessionStorage.getItem(DEV_SW_RESET_KEY)) {
            sessionStorage.setItem(DEV_SW_RESET_KEY, "1");
            window.location.reload();
            return;
          }

          sessionStorage.removeItem(DEV_SW_RESET_KEY);
        })
        .catch(() => undefined);
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => registration.update())
        .catch((error) => {
          console.error("Service worker registration failed", error);
        });
    };

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
