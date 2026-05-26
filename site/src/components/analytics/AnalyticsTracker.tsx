"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SESSION_KEY = "mora_session_id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    // crypto.randomUUID está disponível em todos navegadores modernos
    // (Chrome 92+, Firefox 95+, Safari 15.4+). Fallback caso esteja faltando.
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // sessionStorage pode ser bloqueado (modo anônimo restrito, etc).
    // Gera um id efêmero — visitor vai contar como uma sessão por pageview,
    // mas não vai quebrar a navegação.
    return `eph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

// Extrai o código do imóvel quando o pathname é /imoveis/MB-XXXXX.
// Único lugar onde o tracker precisa saber alguma coisa específica do produto.
function extrairImovelCodigo(pathname: string): string | null {
  const match = pathname.match(/^\/imoveis\/(MB-\d{5})$/);
  return match ? match[1] : null;
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  // Evita double-tracking em strict mode (dev) e re-renders.
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    const imovelCodigo = extrairImovelCodigo(pathname);
    const payload = {
      session_id: getOrCreateSessionId(),
      path: pathname,
      imovel_codigo: imovelCodigo,
      referrer: document.referrer || null,
    };

    const url = `${API_URL}/publico/track`;
    const body = JSON.stringify(payload);

    // sendBeacon não bloqueia navegação e sobrevive a unmount.
    // Fallback pra fetch keepalive caso o browser não suporte ou recuse.
    try {
      const blob = new Blob([body], { type: "application/json" });
      const ok =
        typeof navigator !== "undefined" &&
        "sendBeacon" in navigator &&
        navigator.sendBeacon(url, blob);
      if (!ok) {
        void fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Engole erros — analytics nunca pode quebrar o site.
    }
  }, [pathname]);

  return null;
}
