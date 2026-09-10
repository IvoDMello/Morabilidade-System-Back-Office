"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, MoreVertical, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/stores/app";
import { alternarLista } from "@/lib/listas-api";
import { ordemFimDaColuna } from "@/lib/decisao";
import { corDaLista, separarListas } from "@/lib/listas";
import { engavetadaSemDecisao } from "@/lib/etapa";
import { cn } from "@/lib/utils";
import type { Captacao } from "@/types";
import { ListaDialog } from "./ListaDialog";

/** Largura do painel (w-60) e folga mínima das bordas da tela. */
const LARGURA = 240;
const MARGEM = 8;

type Posicao = { left: number; top?: number; bottom?: number; maxAltura: number };

/**
 * Ancora o painel no botão, em coordenadas de viewport (o painel vai para um
 * portal no `body`). Abre para baixo quando cabe; senão, para cima. A altura
 * máxima é o espaço que sobra, para o painel nunca sangrar para fora da tela.
 */
function calcularPosicao(botao: HTMLElement): Posicao {
  const r = botao.getBoundingClientRect();
  const left = Math.min(
    Math.max(MARGEM, r.right - LARGURA),
    Math.max(MARGEM, window.innerWidth - LARGURA - MARGEM)
  );
  const abaixo = window.innerHeight - r.bottom - MARGEM;
  const acima = r.top - MARGEM;
  return abaixo >= 240 || abaixo >= acima
    ? { left, top: r.bottom + 6, maxAltura: abaixo - 6 }
    : { left, bottom: window.innerHeight - r.top + 6, maxAltura: acima - 6 };
}

/**
 * Menu do cartão: trocar as listas da captação e, quando ela está parada numa
 * gaveta antiga, devolvê-la à fila de decisão.
 *
 * A segunda ação existe porque lista e etapa são coisas diferentes: tirar a
 * etiqueta "Seleção Especial" não muda o `status` legado `selecao_especial`,
 * que é o que mantém o cartão na seção "Engavetadas — reavaliar". Sem uma
 * ação explícita, mexer nas listas parecia não fazer efeito nenhum.
 *
 * O painel aberto vai para um portal no `body` porque quem usa este menu o põe
 * dentro de um `relative z-10` do cartão, e esse z-index cria um contexto de
 * empilhamento: preso ali dentro, o painel ficava por baixo dos botões
 * "Aprovar"/"Reprovar" (também `z-10`, porém depois no DOM). Fora do cartão,
 * nenhum irmão consegue cobri-lo.
 */
export function MenuDaCaptacao({ captacao }: { captacao: Captacao }) {
  const { listas, vinculos, patch, beginSave, endSave } = useApp();
  const [aberto, setAberto] = useState(false);
  const [novaLista, setNovaLista] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  const dentro = useMemo(
    () => new Set(vinculos.filter((v) => v.captacao_id === captacao.id).map((v) => v.lista_id)),
    [vinculos, captacao.id]
  );

  const todas = useMemo(() => {
    const { fixas, migracao } = separarListas(listas);
    return [...fixas, ...migracao];
  }, [listas]);

  const engavetada = engavetadaSemDecisao(captacao);

  // Posiciona antes da pintura, para o painel não piscar no canto errado.
  useLayoutEffect(() => {
    if (aberto && botaoRef.current) setPosicao(calcularPosicao(botaoRef.current));
  }, [aberto]);

  // Rolar ou redimensionar desancoraria o painel do botão: fecha em vez de
  // deixá-lo flutuando solto. `capture` porque a lista rola num contêiner
  // interno e o evento de scroll não borbulha.
  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setAberto(false);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  async function alternar(listaId: string) {
    const estava = dentro.has(listaId);
    const ok = await alternarLista(captacao.id, listaId, !estava);
    if (!ok) toast.error(estava ? "Não foi possível tirar da lista." : "Não foi possível adicionar à lista.");
  }

  /** Devolve à fila de decisão preservando as listas (a etiqueta é organização). */
  async function voltarParaFila() {
    setOcupado(true);
    beginSave();
    const ordem = await ordemFimDaColuna("em_decisao");
    const supabase = createClient();
    const { error } = await supabase.rpc("mover_cartao", {
      p_captacao_id: captacao.id,
      p_para_status: "em_decisao",
      p_ordem: ordem,
      p_decisao: null,
    });
    setOcupado(false);
    endSave(!error);
    if (error) return toast.error("Não foi possível voltar a captação para a fila.");

    patch(captacao.id, { status: "em_decisao", ordem });
    setAberto(false);
    toast.success("De volta à fila de decisão. As listas foram mantidas.");
  }

  const painel = aberto && posicao && (
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        className="fixed inset-0 z-40 cursor-default"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAberto(false);
        }}
      />
      <div
        className="fixed z-50 flex w-60 flex-col overflow-hidden rounded-xl border bg-card shadow-lg"
        style={{
          left: posicao.left,
          top: posicao.top,
          bottom: posicao.bottom,
          maxHeight: posicao.maxAltura,
        }}
        // O portal continua na árvore React do cartão: sem parar o clique aqui,
        // ele borbulharia para o link/handler do cartão e abriria a captação.
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <p className="flex-none px-3 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Listas
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-1">
          {todas.length === 0 && (
            <p className="px-2 pb-2 text-[12.5px] text-muted-foreground">Nenhuma lista ainda.</p>
          )}
          {todas.map((l) => {
            const cor = corDaLista(l);
            const on = dentro.has(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => alternar(l.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-muted",
                  on && "font-semibold"
                )}
              >
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: cor.dot }} />
                <span className="min-w-0 flex-1 truncate">{l.nome}</span>
                {on && <Check className="h-4 w-4 flex-none text-secondary" strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setNovaLista(true);
          }}
          className="flex w-full flex-none items-center gap-2.5 border-t px-3 py-2.5 text-left text-[13px] text-muted-foreground hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          Nova lista
        </button>

        {engavetada && (
          <button
            type="button"
            onClick={voltarParaFila}
            disabled={ocupado}
            className="flex w-full flex-none items-start gap-2.5 border-t px-3 py-2.5 text-left hover:bg-muted disabled:opacity-60"
          >
            <Undo2 className="mt-0.5 h-4 w-4 flex-none text-secondary" strokeWidth={2.2} />
            <span>
              <span className="block text-[13px] font-semibold text-foreground">
                Voltar para a fila de decisão
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                Sai de &ldquo;Engavetadas&rdquo;. As listas continuam.
              </span>
            </span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAberto((v) => !v);
        }}
        aria-label="Opções da captação"
        aria-expanded={aberto}
        className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-muted text-muted-foreground"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>

      {painel && createPortal(painel, document.body)}

      <ListaDialog
        open={novaLista}
        onOpenChange={setNovaLista}
        onCriada={(l) => alternarLista(captacao.id, l.id, true)}
      />
    </>
  );
}
