"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { defaultsDoLink } from "@/lib/captacao-link";
import { NovaCaptacaoButton } from "./NovaCaptacaoButton";

/**
 * Abre o formulário de nova captação a partir de um link externo (hoje: o
 * copiloto do WhatsApp, que manda o que leu da conversa na query string).
 *
 * Fica montado UMA vez na página do board, e não dentro do NovaCaptacaoButton:
 * o botão aparece em três lugares (topbar, FAB do mobile, estado vazio) e no
 * mobile a topbar continua montada só escondida por CSS — ler a URL lá dentro
 * abriria dois diálogos ao mesmo tempo.
 */
export function NovaCaptacaoDeLink() {
  const params = useSearchParams();
  const router = useRouter();

  // A query string não muda enquanto o diálogo está aberto; recalcular os
  // defaults a cada render remontaria o formulário e apagaria o que a pessoa
  // já digitou.
  const defaults = useMemo(
    () => defaultsDoLink(new URLSearchParams(params.toString())),
    [params],
  );

  if (!defaults) return null;

  return (
    <NovaCaptacaoButton
      // Key pela query: um segundo link com dados diferentes precisa remontar o
      // formulário, senão o react-hook-form mantém os defaults do primeiro.
      key={params.toString()}
      defaults={defaults}
      defaultOpen
      trigger={<span className="sr-only" aria-hidden />}
      // Fechou (salvando ou desistindo): tira os parâmetros para um F5 não
      // reabrir o formulário com dados que já viraram cartão.
      onClose={() => router.replace("/board")}
    />
  );
}
