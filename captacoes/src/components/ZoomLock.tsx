"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Eventos de pinch do WebKit — só o Safari os dispara. */
const GESTURE_EVENTS = ["gesturestart", "gesturechange", "gestureend"];

/**
 * Classe que solta o `touch-action` do html (ver globals.css). Só o JS pode
 * pô-la: no App Router apenas o layout raiz renderiza a tag <html>, então uma
 * página lá embaixo não tem como marcá-la no servidor.
 */
const LIVRE = "zoom-livre";

/** A trava vale no app interno; as páginas públicas de imóvel ficam de fora. */
function zoomTravado(pathname: string): boolean {
  return !pathname.startsWith("/p/");
}

/**
 * O Safari do iOS ignora `user-scalable=no` quando o app roda numa aba do
 * navegador (a partir do iOS 10); o meta viewport só vale de verdade no modo
 * PWA instalado. Cancelar os eventos `gesture*` é o que sobra para o pinch
 * parar também na aba. Nos demais navegadores nada disso dispara e o
 * componente é inerte.
 *
 * Mesma trava do app whatsapp/ — ver `viewport` em app/layout.tsx e
 * `touch-action` no globals.css, que são as outras duas camadas.
 *
 * Exceção: `/p/[token]` é a apresentação do imóvel que vai por WhatsApp para
 * um cliente. A trava foi pensada para o quadro interno (pinch acidental ao
 * rolar as colunas); numa página cujo conteúdo são fotos de imóvel, impedir a
 * ampliação seria o contrário do que ela existe para fazer. Aqui o componente
 * desliga as três camadas de uma vez.
 */
export function ZoomLock() {
  const pathname = usePathname();
  const travar = zoomTravado(pathname);

  useEffect(() => {
    const raiz = document.documentElement;
    // No desktop o pinch é o do trackpad — no Safari do macOS ele também
    // dispara `gesture*`, e travá-lo ali seria tirar o zoom de quem tem
    // ponteiro de verdade. A trava existe para o dedo.
    const dedo = window.matchMedia("(pointer: coarse)").matches;
    if (!travar || !dedo) {
      raiz.classList.add(LIVRE);
      return () => raiz.classList.remove(LIVRE);
    }

    raiz.classList.remove(LIVRE);
    const block = (event: Event) => event.preventDefault();
    for (const name of GESTURE_EVENTS) {
      document.addEventListener(name, block, { passive: false });
    }
    return () => {
      for (const name of GESTURE_EVENTS) {
        document.removeEventListener(name, block);
      }
    };
  }, [travar]);

  return null;
}
