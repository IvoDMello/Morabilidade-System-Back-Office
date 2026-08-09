"use client";

import { useEffect } from "react";

/** Eventos de pinch do WebKit — só o Safari os dispara. */
const GESTURE_EVENTS = ["gesturestart", "gesturechange", "gestureend"];

/**
 * O Safari do iOS ignora `user-scalable=no` quando o app roda numa aba do
 * navegador (a partir do iOS 10); o meta viewport só vale de verdade no modo
 * PWA instalado. Cancelar os eventos `gesture*` é o que sobra para o pinch
 * parar também na aba. Nos demais navegadores nada disso dispara e o
 * componente é inerte.
 *
 * Mesma trava do app whatsapp/ — ver `viewport` em app/layout.tsx e
 * `touch-action` no globals.css, que são as outras duas camadas.
 */
export function ZoomLock() {
  useEffect(() => {
    const block = (event: Event) => event.preventDefault();
    for (const name of GESTURE_EVENTS) {
      document.addEventListener(name, block, { passive: false });
    }
    return () => {
      for (const name of GESTURE_EVENTS) {
        document.removeEventListener(name, block);
      }
    };
  }, []);

  return null;
}
