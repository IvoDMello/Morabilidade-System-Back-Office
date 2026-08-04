"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  proporAcoesAction,
  executarAcaoAction,
  type ProporResultado,
} from "@/app/assistente/actions";
import { ProposalCard, type PropostaStatus } from "./proposal-card";
import { linkNovaCaptacao, rascunhoDaProposta } from "@/lib/captacao-link";
import type { AcaoProposta } from "@/services/assistant";

interface Item extends AcaoProposta {
  status: PropostaStatus;
}

const EXEMPLOS = [
  "Agendar visita com o Marcos amanhã às 15h no MB-00033",
  "Criar captação: Rua das Acácias 120, 3 quartos, portaria 24h",
];

export function AssistantConsole({ captacoesUrl }: { captacoesUrl: string | null }) {
  const [instrucao, setInstrucao] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  // Muda a cada nova rodada de propostas. Entra na `key` dos cartões para que
  // uma proposta nova não herde o texto que o operador tinha editado na
  // anterior — o índice sozinho reaproveitaria o componente.
  const [geracao, setGeracao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [isProposing, startProposing] = useTransition();
  const [executingIdx, setExecutingIdx] = useState<number | null>(null);

  function propor() {
    setErro(null);
    startProposing(async () => {
      const res: ProporResultado = await proporAcoesAction(instrucao);
      if (!res.ok || res.propostas.length === 0) {
        setItems([]);
        setErro(res.erro ?? "Nenhuma ação identificada.");
        return;
      }
      setGeracao((g) => g + 1);
      setItems(res.propostas.map((p) => ({ ...p, status: { kind: "pending" } })));
    });
  }

  function confirmar(idx: number, textoFinal: string | null) {
    const item = items[idx];
    const args = textoFinal === null ? item.args : { ...item.args, texto: textoFinal };

    // Captação não nasce aqui: vai para o formulário completo do board, onde
    // ganha os campos obrigatórios e passa pela checagem de duplicadas. Mesma
    // regra do copiloto da conversa — um caminho só para criar captação.
    if (item.tool === "criar_captacao") {
      const href = linkNovaCaptacao(captacoesUrl, rascunhoDaProposta(args));
      if (!href) {
        toast.error("Board de captações não configurado (CAPTACOES_BOARD_URL).");
        return;
      }
      window.open(href, "_blank", "noopener,noreferrer");
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx
            ? { ...it, status: { kind: "done", message: "Aberto no board para você completar." } }
            : it,
        ),
      );
      return;
    }

    setExecutingIdx(idx);
    executarAcaoAction(item.tool, args).then((res) => {
      setExecutingIdx(null);
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx
            ? { ...it, status: res.ok ? { kind: "done", message: res.message } : { kind: "error", message: res.message } }
            : it,
        ),
      );
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  function dispensar(idx: number) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, status: { kind: "dismissed" } } : it)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
        <Textarea
          aria-label="O que você quer que o assistente faça"
          value={instrucao}
          onChange={(e) => setInstrucao(e.target.value)}
          placeholder="Descreva o que você quer fazer… (ex.: agendar visita, criar captação)"
          rows={3}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") propor();
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {EXEMPLOS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setInstrucao(ex)}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                {ex}
              </button>
            ))}
          </div>
          <Button onClick={propor} loading={isProposing} disabled={!instrucao.trim()}>
            <Sparkles className="h-4 w-4" />
            Analisar
          </Button>
        </div>
      </div>

      {erro && (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">{erro}</p>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Ações propostas — confirme para executar
          </p>
          {items.map((item, idx) =>
            item.status.kind === "dismissed" ? null : (
              <ProposalCard
                key={`${geracao}-${idx}`}
                proposta={item}
                status={item.status}
                isExecuting={executingIdx === idx}
                onConfirm={(textoFinal) => confirmar(idx, textoFinal)}
                onDismiss={() => dispensar(idx)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
