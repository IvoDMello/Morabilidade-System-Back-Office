"use client";

import { useState } from "react";
import { MessagesSquare, IdCard } from "lucide-react";
import { cn } from "@/lib/utils";

type Aba = "atividade" | "dados";

const ABAS: { value: Aba; label: string; icon: typeof IdCard }[] = [
  { value: "dados", label: "Dados do contato", icon: IdCard },
  { value: "atividade", label: "Atividade", icon: MessagesSquare },
];

interface ContactPanelsProps {
  /** Coluna esquerda: identidade, corretor, etiquetas, IA, lembretes, imóveis. */
  dados: React.ReactNode;
  /** Coluna direita: mensagens + anotações + eventos, com o composer. */
  atividade: React.ReactNode;
}

/**
 * As duas metades da ficha do contato.
 *
 * No desktop elas convivem lado a lado — é o ponto forte da tela: dá para ler
 * a conversa sem perder de vista lembretes e imóveis. No celular não cabem, e
 * empilhar punia quem só queria a conversa: eram cinco cartões de rolagem
 * antes da primeira mensagem. Aqui viram duas abas.
 *
 * A ficha abre nos **dados**: quem entra em /contatos/[id] veio ver quem é a
 * pessoa — telefone, responsável, lembretes, imóveis, o que o sistema já sabe
 * dela. Quem quer a conversa vai para o inbox, que é onde se conversa; a
 * ficha abrir no histórico duplicava o inbox e escondia o resto.
 *
 * O switch só existe abaixo de `lg` — no desktop não há decisão a tomar, e um
 * controle que não decide nada é ruído.
 */
export function ContactPanels({ dados, atividade }: ContactPanelsProps) {
  const [aba, setAba] = useState<Aba>("dados");

  return (
    <>
      <div
        role="tablist"
        aria-label="Seções da ficha do contato"
        className="flex items-center gap-0.5 rounded-[10px] border border-veil/6 bg-card p-[3px] lg:hidden"
      >
        {ABAS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={aba === value}
            onClick={() => setAba(value)}
            className={cn(
              "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-colors",
              aba === value
                ? "bg-veil/10 text-foreground"
                : "text-muted-foreground hover:text-ink-mid",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div
          className={cn(
            "flex w-full flex-col gap-4 lg:sticky lg:top-6 lg:w-[340px] lg:shrink-0",
            aba !== "dados" && "max-lg:hidden",
          )}
        >
          {dados}
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col rounded-lg border bg-card p-4 lg:h-[calc(100vh-11rem)]",
            aba !== "atividade" && "max-lg:hidden",
          )}
        >
          {atividade}
        </div>
      </div>
    </>
  );
}
