"use client";

import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { orderBetween } from "@/lib/order";
import { corDaLista } from "@/lib/listas";
import { cn } from "@/lib/utils";
import type { Lista } from "@/types";

/**
 * Pills das listas da captação, no detalhe, com um menu para pôr e tirar.
 *
 * Busca sozinha: o detalhe vive fora do store das abas (é uma rota própria,
 * aberta direto por link) e não pode depender de ele estar hidratado.
 */
export function ListasDaCaptacao({ captacaoId }: { captacaoId: string }) {
  const [listas, setListas] = useState<Lista[]>([]);
  const [dentro, setDentro] = useState<Set<string>>(new Set());
  const [menuAberto, setMenuAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    const supabase = createClient();
    Promise.all([
      supabase.from("lista").select("*").order("ordem", { ascending: true }),
      supabase.from("captacao_lista").select("lista_id").eq("captacao_id", captacaoId),
    ]).then(([{ data: todas }, { data: minhas }]) => {
      if (!ativo) return;
      setListas((todas ?? []) as Lista[]);
      setDentro(new Set(((minhas ?? []) as { lista_id: string }[]).map((v) => v.lista_id)));
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [captacaoId]);

  async function alternar(lista: Lista) {
    const estava = dentro.has(lista.id);
    const proximo = new Set(dentro);
    if (estava) proximo.delete(lista.id);
    else proximo.add(lista.id);
    setDentro(proximo);

    const supabase = createClient();
    if (estava) {
      const { error } = await supabase
        .from("captacao_lista")
        .delete()
        .eq("captacao_id", captacaoId)
        .eq("lista_id", lista.id);
      if (error) {
        setDentro(dentro);
        toast.error("Não foi possível tirar da lista.");
      }
      return;
    }

    // Entra no fim da sequência daquela lista.
    const { data: ultimos } = await supabase
      .from("captacao_lista")
      .select("ordem")
      .eq("lista_id", lista.id)
      .order("ordem", { ascending: false })
      .limit(1);

    const { error } = await supabase
      .from("captacao_lista")
      .upsert({
        captacao_id: captacaoId,
        lista_id: lista.id,
        ordem: orderBetween(ultimos?.[0]?.ordem ?? null, null),
      });
    if (error) {
      setDentro(dentro);
      toast.error("Não foi possível adicionar à lista.");
    }
  }

  if (carregando || listas.length === 0) return null;

  const minhas = listas.filter((l) => dentro.has(l.id));

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {minhas.map((l) => {
        const cor = corDaLista(l);
        return (
          <span
            key={l.id}
            className="inline-flex h-[25px] items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-semibold"
            style={{ background: cor.bg, color: cor.fg }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: cor.dot }} />
            {l.nome}
          </span>
        );
      })}

      <button
        type="button"
        onClick={() => setMenuAberto((v) => !v)}
        aria-expanded={menuAberto}
        className="inline-flex h-[25px] items-center gap-1.5 rounded-lg border border-dashed border-[#c8cac1] px-2.5 text-[11.5px] font-semibold text-muted-foreground"
      >
        <Plus className="h-3 w-3" strokeWidth={2.6} />
        Lista
      </button>

      {menuAberto && (
        <>
          <button
            type="button"
            aria-label="Fechar"
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setMenuAberto(false)}
          />
          <div className="absolute left-0 top-9 z-30 max-h-64 w-60 overflow-y-auto rounded-xl border bg-card p-1 shadow-lg">
            {listas.map((l) => {
              const cor = corDaLista(l);
              const on = dentro.has(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => alternar(l)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted",
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
        </>
      )}
    </div>
  );
}
