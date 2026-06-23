"use client";

import { useEffect, useLayoutEffect, useState } from "react";

// useLayoutEffect roda antes da pintura (evita flash do layout errado);
// no servidor cai para useEffect só para não emitir warning do React.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * `true` em telas >= lg (1024px), `false` abaixo, `null` enquanto não mediu.
 * Retornar `null` antes de medir evita renderizar o board errado por um frame
 * (mobile no desktop e vice-versa) e o double-fetch de capas no mobile.
 */
export function useIsDesktop() {
  const [desktop, setDesktop] = useState<boolean | null>(null);

  useIsoLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return desktop;
}
