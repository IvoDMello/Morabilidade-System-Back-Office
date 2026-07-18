"use client";

import { useEffect, useRef } from "react";
import { refreshTokens } from "@/lib/api";

const STORAGE_KEY = "morabilidade-expires-at";

// Margem de segurança: renova 60s antes do exp. Se o user clicar "Salvar"
// nesse intervalo, o request usa o token novo. Sem isso, race entre o timer
// e a request humana derruba o cookie no meio.
const REFRESH_MARGIN_MS = 60_000;

// Quando a aba volta a ter foco, se faltar menos que isso pro exp, faz refresh
// imediato antes do user clicar em qualquer coisa.
const FOREGROUND_MIN_REMAINING_MS = 120_000;

function readExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function writeExpiresAt(expiresIn: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(Date.now() + expiresIn * 1000));
}

function clearExpiresAt() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Refresh proativo do JWT.
 *
 * Por que existe: o cookie de access é httpOnly (JS não lê), e tokens
 * expiram em ~1h. Sem isso, o usuário só descobre que a sessão venceu
 * quando clica "Salvar" depois de preencher um form longo, perdendo o
 * estado. Aqui renovamos antes da janela fechar.
 *
 * Como funciona:
 *   1. Após login bem-sucedido, a página dispara `auth:logged-in` com expires_in.
 *   2. Interceptor axios dispara `auth:refreshed` após refresh reativo (em 401).
 *   3. Este provider agenda um timer para REFRESH_MARGIN_MS antes do exp.
 *   4. Ao voltar a aba para foreground, refresca se faltar pouco tempo.
 *
 * Tudo via cookie httpOnly, refresh_token nunca toca o JS.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const timerRef = useRef<number | null>(null);
  const inflightRef = useRef(false);

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    async function doRefresh() {
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        const ok = await refreshTokens();
        if (!ok) {
          // Falha real (refresh_token expirado ou revogado). Limpa o marcador
          // e deixa a próxima request 401 disparar o logout/redirect.
          clearExpiresAt();
        }
      } finally {
        inflightRef.current = false;
      }
    }

    function schedule() {
      clearTimer();
      const expiresAt = readExpiresAt();
      if (!expiresAt) return;
      const ms = expiresAt - Date.now() - REFRESH_MARGIN_MS;
      // Mínimo 5s para evitar tight loop se algo der errado no cálculo.
      const delay = Math.max(5_000, ms);
      timerRef.current = window.setTimeout(() => {
        void doRefresh();
      }, delay);
    }

    function handleLoggedIn(e: Event) {
      const detail = (e as CustomEvent<{ expires_in?: number }>).detail;
      if (typeof detail?.expires_in === "number") {
        writeExpiresAt(detail.expires_in);
        schedule();
      }
    }

    function handleRefreshed(e: Event) {
      const detail = (e as CustomEvent<{ expires_in?: number }>).detail;
      if (typeof detail?.expires_in === "number") {
        writeExpiresAt(detail.expires_in);
        schedule();
      }
    }

    function handleLoggedOut() {
      clearExpiresAt();
      clearTimer();
    }

    function handleVisibility() {
      if (document.visibilityState !== "visible") return;
      const expiresAt = readExpiresAt();
      if (!expiresAt) return;
      const remaining = expiresAt - Date.now();
      if (remaining < FOREGROUND_MIN_REMAINING_MS) {
        void doRefresh();
      } else {
        // Aba ficou em background e o timer pode ter sido suspenso. Reagenda.
        schedule();
      }
    }

    window.addEventListener("auth:logged-in", handleLoggedIn as EventListener);
    window.addEventListener("auth:refreshed", handleRefreshed as EventListener);
    window.addEventListener("auth:logged-out", handleLoggedOut);
    document.addEventListener("visibilitychange", handleVisibility);

    // Boot: se já estamos logados (page refresh), reagendar.
    schedule();

    return () => {
      window.removeEventListener("auth:logged-in", handleLoggedIn as EventListener);
      window.removeEventListener("auth:refreshed", handleRefreshed as EventListener);
      window.removeEventListener("auth:logged-out", handleLoggedOut);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTimer();
    };
  }, []);

  return <>{children}</>;
}
