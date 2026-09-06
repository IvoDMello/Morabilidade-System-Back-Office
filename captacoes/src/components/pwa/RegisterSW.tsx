"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Registra o service worker (PWA) uma vez, no cliente.
 *
 * Fora das páginas públicas de imóvel: quem abre um link compartilhado é um
 * cliente, não a equipe — não faz sentido instalar o service worker do app
 * interno no aparelho dele, nem oferecer a instalação de um PWA cujo
 * `start_url` é o quadro atrás do login.
 */
export function RegisterSW() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/p/")) return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // falha de registro não deve quebrar o app
      });
    }
  }, [pathname]);

  return null;
}
