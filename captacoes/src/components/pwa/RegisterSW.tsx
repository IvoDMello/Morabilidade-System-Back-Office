"use client";

import { useEffect } from "react";

/** Registra o service worker (PWA) uma vez, no cliente. */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // falha de registro não deve quebrar o app
      });
    }
  }, []);

  return null;
}
