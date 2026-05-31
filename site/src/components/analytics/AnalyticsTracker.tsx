"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getOrCreateSessionId, sendBeaconJSON } from "@/lib/session";

function extrairImovelCodigo(pathname: string): string | null {
  const match = pathname.match(/^\/imoveis\/(MB-\d{5})$/);
  return match ? match[1] : null;
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    sendBeaconJSON("/publico/track", {
      session_id: getOrCreateSessionId(),
      path: pathname,
      imovel_codigo: extrairImovelCodigo(pathname),
      referrer: document.referrer || null,
    });
  }, [pathname]);

  return null;
}
