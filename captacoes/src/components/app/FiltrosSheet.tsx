"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/stores/app";
import { bairrosDisponiveis, filtrarCaptacoes, filtrarPorCriterios } from "@/lib/filter";
import { corDaLista, separarListas } from "@/lib/listas";
import { formatBRL, parseMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CRITERIOS_VAZIO,
  SITUACAO_LABEL,
  SITUACOES,
  type Captacao,
  type Criterios,
  type Situacao,
} from "@/types";

/**
 * Painel de filtros. É o substituto das colunas: precisa ser bom o bastante
 * para ninguém sentir falta delas, então mostra a contagem do resultado no
 * botão de aplicar antes de fechar.
 */
export function FiltrosSheet({
  open,
  onOpenChange,
  universo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Captações da aba, para contar o resultado e listar os bairros. */
  universo: Captacao[];
}) {
  const { criterios, setCriterios, limparCriterios, listas, vinculos, filtro } = useApp();
  const [rascunho, setRascunho] = useState<Criterios>(criterios);

  useEffect(() => {
    if (open) setRascunho(criterios);
  }, [open, criterios]);

  const bairros = useMemo(() => bairrosDisponiveis(universo), [universo]);
  const todasListas = useMemo(() => {
    const { fixas, migracao } = separarListas(listas);
    return [...fixas, ...migracao];
  }, [listas]);

  const listasPorCaptacao = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const v of vinculos) {
      const atual = m.get(v.captacao_id);
      if (atual) atual.push(v.lista_id);
      else m.set(v.captacao_id, [v.lista_id]);
    }
    return m;
  }, [vinculos]);

  const resultado = useMemo(
    () => filtrarPorCriterios(filtrarCaptacoes(universo, filtro), rascunho, { listasPorCaptacao }).length,
    [universo, filtro, rascunho, listasPorCaptacao]
  );

  const set = (p: Partial<Criterios>) => setRascunho((r) => ({ ...r, ...p }));

  function alternar<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-md flex-col gap-0 p-0">
        <DialogHeader className="flex-none border-b px-5 py-4">
          <DialogTitle className="font-serif text-xl">Filtros</DialogTitle>
          <DialogDescription>Refine as captações desta aba.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {todasListas.length > 0 && (
            <Secao titulo="Listas">
              <div className="flex flex-wrap gap-2">
                {todasListas.map((l) => {
                  const cor = corDaLista(l);
                  const on = rascunho.listas.includes(l.id);
                  return (
                    <Chip key={l.id} on={on} onClick={() => set({ listas: alternar(rascunho.listas, l.id) })}>
                      <span className="h-2 w-2 rounded-full" style={{ background: cor.dot }} />
                      {l.nome}
                    </Chip>
                  );
                })}
              </div>
            </Secao>
          )}

          {bairros.length > 0 && (
            <Secao titulo="Bairro">
              <div className="flex flex-wrap gap-2">
                {bairros.map((b) => (
                  <Chip
                    key={b}
                    on={rascunho.bairros.includes(b)}
                    onClick={() => set({ bairros: alternar(rascunho.bairros, b) })}
                  >
                    {b}
                  </Chip>
                ))}
              </div>
            </Secao>
          )}

          <Secao titulo="Valor de venda">
            <Faixa
              minLabel="Mínimo"
              maxLabel="Máximo"
              min={rascunho.valorMin}
              max={rascunho.valorMax}
              formatar={(v) => formatBRL(v)}
              onMin={(v) => set({ valorMin: v })}
              onMax={(v) => set({ valorMax: v })}
            />
          </Secao>

          <Secao titulo="Metragem">
            <Faixa
              minLabel="Mínima"
              maxLabel="Máxima"
              min={rascunho.metragemMin}
              max={rascunho.metragemMax}
              formatar={(v) => `${v} m²`}
              onMin={(v) => set({ metragemMin: v })}
              onMax={(v) => set({ metragemMax: v })}
            />
          </Secao>

          <Secao titulo="Mínimos">
            <div className="divide-y overflow-hidden rounded-xl border">
              <Stepper label="Quartos" valor={rascunho.quartosMin} onChange={(v) => set({ quartosMin: v })} />
              <Stepper label="Suítes" valor={rascunho.suitesMin} onChange={(v) => set({ suitesMin: v })} />
              <Stepper label="Vagas" valor={rascunho.vagasMin} onChange={(v) => set({ vagasMin: v })} />
            </div>
          </Secao>

          <Secao titulo="Período de entrada">
            <div className="flex items-center gap-2.5">
              <Input
                type="date"
                aria-label="Entrada a partir de"
                value={rascunho.entradaDe ?? ""}
                onChange={(e) => set({ entradaDe: e.target.value || null })}
              />
              <span className="text-muted-foreground">—</span>
              <Input
                type="date"
                aria-label="Entrada até"
                value={rascunho.entradaAte ?? ""}
                onChange={(e) => set({ entradaAte: e.target.value || null })}
              />
            </div>
          </Secao>

          <Secao titulo="Situação">
            <div className="divide-y overflow-hidden rounded-xl border">
              {SITUACOES.map((s: Situacao) => {
                const on = rascunho.situacoes.includes(s);
                return (
                  <label
                    key={s}
                    className="flex cursor-pointer items-center gap-3 bg-card px-3.5 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => set({ situacoes: alternar(rascunho.situacoes, s) })}
                      className="h-5 w-5 rounded-md border-input accent-secondary"
                    />
                    {SITUACAO_LABEL[s]}
                  </label>
                );
              })}
            </div>
          </Secao>
        </div>

        <DialogFooter className="flex-none gap-2.5 border-t px-5 py-4 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => {
              limparCriterios();
              setRascunho(CRITERIOS_VAZIO);
              onOpenChange(false);
            }}
          >
            Limpar
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => {
              setCriterios(rascunho);
              onOpenChange(false);
            }}
          >
            Ver {resultado} {resultado === 1 ? "captação" : "captações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold",
        on ? "border-secondary bg-secondary text-secondary-foreground" : "border-input bg-card text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Faixa({
  minLabel,
  maxLabel,
  min,
  max,
  formatar,
  onMin,
  onMax,
}: {
  minLabel: string;
  maxLabel: string;
  min: number | null;
  max: number | null;
  formatar: (v: number) => string;
  onMin: (v: number | null) => void;
  onMax: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <CampoNumero label={minLabel} valor={min} formatar={formatar} onChange={onMin} />
      <span className="text-muted-foreground">—</span>
      <CampoNumero label={maxLabel} valor={max} formatar={formatar} onChange={onMax} />
    </div>
  );
}

function CampoNumero({
  label,
  valor,
  formatar,
  onChange,
}: {
  label: string;
  valor: number | null;
  formatar: (v: number) => string;
  onChange: (v: number | null) => void;
}) {
  const [texto, setTexto] = useState(valor?.toString() ?? "");
  const [focado, setFocado] = useState(false);

  useEffect(() => {
    if (!focado) setTexto(valor?.toString() ?? "");
  }, [valor, focado]);

  return (
    <label className="flex-1 rounded-xl border bg-card px-3 py-2">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        inputMode="numeric"
        value={focado || !valor ? texto : formatar(valor)}
        placeholder="Sem limite"
        onFocus={() => setFocado(true)}
        onBlur={() => {
          setFocado(false);
          onChange(parseMoeda(texto));
        }}
        onChange={(e) => setTexto(e.target.value)}
        className="mt-0.5 w-full bg-transparent text-[15px] font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
      />
    </label>
  );
}

function Stepper({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-card px-3.5 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(valor && valor > 1 ? valor - 1 : null)}
          disabled={valor == null}
          aria-label={`Diminuir ${label}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-6 text-center text-[15px] font-bold text-foreground">{valor ?? "—"}</span>
        <button
          type="button"
          onClick={() => onChange((valor ?? 0) + 1)}
          aria-label={`Aumentar ${label}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-secondary"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
