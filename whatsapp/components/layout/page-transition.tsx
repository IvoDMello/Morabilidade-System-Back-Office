"use client";

import { usePathname } from "next/navigation";

/** Fade curto ao trocar de tela. Acima de ~150ms a transição deixa de suavizar
 * e vira espera: a tela nova já chegou e o usuário continua olhando o fade. O
 * slide saiu pelo mesmo motivo — o conteúdo se assenta antes de ser lido. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className="animate-in fade-in duration-150 ease-out motion-reduce:animate-none"
    >
      {children}
    </div>
  );
}
