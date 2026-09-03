"use client";

import { useMemo, useRef, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { useBoard } from "@/stores/board";
import { filtrarCaptacoes } from "@/lib/filter";
import { textoDaCaptacao } from "@/lib/pauta";
import { BOARD_STATUSES } from "@/types";

/**
 * Composer de item da pauta: um campo só.
 *
 * Enter adiciona o que foi digitado como texto livre. Enquanto digita, as
 * captações do quadro que casam com o texto aparecem como sugestão — clicar
 * numa delas cria o item já ligado àquela captação. Assim dá pra montar a
 * sequência de gravação tanto com imóveis do quadro quanto com recados
 * soltos ("passar no cartório", "refilmar a fachada").
 */
export function AdicionarItem({
  onAdicionar,
}: {
  onAdicionar: (texto: string, captacaoId: string | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [focado, setFocado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const byStatus = useBoard((s) => s.byStatus);

  const sugestoes = useMemo(() => {
    const busca = texto.trim();
    if (busca.length < 2) return [];
    const todas = BOARD_STATUSES.flatMap((s) => byStatus[s]);
    return filtrarCaptacoes(todas, busca).slice(0, 5);
  }, [texto, byStatus]);

  function adicionar(captacaoId: string | null, textoFinal?: string) {
    const limpo = (textoFinal ?? texto).trim();
    if (!limpo) return;
    onAdicionar(limpo, captacaoId);
    setTexto("");
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1 rounded-md border border-dashed px-1.5 py-1 focus-within:border-solid focus-within:border-ring">
        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setFocado(true)}
          // Timeout: o blur dispara antes do clique na sugestão registrar.
          onBlur={() => setTimeout(() => setFocado(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar(null);
            }
            if (e.key === "Escape") setTexto("");
          }}
          maxLength={500}
          placeholder="Adicionar à sequência…"
          className="w-full bg-transparent py-0.5 text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>

      {focado && sugestoes.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-popover shadow-lg">
          <li className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Captações do quadro
          </li>
          {sugestoes.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => adicionar(c.id, textoDaCaptacao(c))}
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{textoDaCaptacao(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
