"use client";

import { useMemo, useState } from "react";
import { Search, Sparkles, UserSearch, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { OportunidadeCard } from "./oportunidade-card";
import { cn } from "@/lib/utils";
import type { PainelOportunidades } from "@/types/oportunidade";

type Filtro = "prontos" | "quase" | "sem_perfil" | "todos";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "prontos", rotulo: "Prontos para enviar" },
  { valor: "quase", rotulo: "Quase lá" },
  { valor: "sem_perfil", rotulo: "Sem perfil" },
  { valor: "todos", rotulo: "Todos" },
];

interface OportunidadesViewProps {
  painel: PainelOportunidades;
  siteUrl: string | null;
  /** Contato a abrir de cara, vindo de `?c=<id>` (link da conversa). */
  contatoDestacado?: string;
}

/**
 * A aba inteira.
 *
 * Abre em "Prontos para enviar" de propósito: a lista completa é um relatório,
 * e relatório é justamente o que o painel web já era — a versão que ninguém
 * usava porque não levava a lugar nenhum. Aqui a tela abre no subconjunto em
 * que existe uma ação óbvia (escolher imóvel, revisar texto, enviar), e as
 * outras visões ficam a um clique.
 */
export function OportunidadesView({
  painel,
  siteUrl,
  contatoDestacado,
}: OportunidadesViewProps) {
  const [filtro, setFiltro] = useState<Filtro>("prontos");
  const [busca, setBusca] = useState("");

  const contagens = useMemo(
    () => ({
      prontos: painel.itens.filter((i) => i.compativeis > 0).length,
      quase: painel.itens.filter((i) => i.compativeis === 0 && i.imoveis.length > 0).length,
      sem_perfil: painel.itens.filter((i) => !i.preferencia).length,
      todos: painel.itens.length,
    }),
    [painel.itens],
  );

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return painel.itens.filter((item) => {
      if (filtro === "prontos" && item.compativeis === 0) return false;
      if (filtro === "quase" && !(item.compativeis === 0 && item.imoveis.length > 0)) return false;
      if (filtro === "sem_perfil" && item.preferencia) return false;
      if (!termo) return true;
      return (
        item.nome.toLowerCase().includes(termo) ||
        item.telefone.includes(termo.replace(/\D/g, "")) ||
        item.imoveis.some((im) => im.codigo.toLowerCase().includes(termo))
      );
    });
  }, [painel.itens, filtro, busca]);

  const totalProntos = painel.itens.reduce((soma, i) => soma + i.compativeis, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo honesto do que a aba enxergou */}
      {painel.catalogoDisponivel ? (
        <p className="flex flex-wrap items-center gap-x-1.5 rounded-lg bg-primary/8 px-3 py-2 text-[12.5px] text-ink-mid">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-gold" />
          <strong className="font-semibold text-foreground">
            {totalProntos} {totalProntos === 1 ? "oportunidade" : "oportunidades"}
          </strong>
          <span>
            em {contagens.prontos} {contagens.prontos === 1 ? "contato" : "contatos"}, sobre{" "}
            {painel.totalImoveis} {painel.totalImoveis === 1 ? "imóvel" : "imóveis"} disponíveis.
          </span>
        </p>
      ) : (
        <p className="rounded-lg bg-ember/10 px-3 py-2 text-[12.5px] text-ember">
          O catálogo de imóveis não respondeu agora — a lista abaixo está sem os cruzamentos.
          O perfil de busca de cada contato continua editável.
        </p>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar por contato ou código de imóvel"
            placeholder="Nome, telefone ou código do imóvel"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              aria-pressed={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] whitespace-nowrap transition-colors",
                filtro === f.valor
                  ? "border-primary/35 bg-primary/10 text-gold"
                  : "border-veil/9 bg-card text-ink-mid hover:border-veil/16",
              )}
            >
              {f.rotulo}
              <span className="tabular-nums opacity-70">{contagens[f.valor]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {visiveis.length === 0 ? (
        <EmptyState
          icon={filtro === "sem_perfil" ? UserSearch : Users}
          title={
            busca.trim()
              ? "Nada encontrado com esse termo"
              : filtro === "prontos"
                ? "Nenhum contato com imóvel pronto para enviar"
                : "Nada nesta visão"
          }
          description={
            busca.trim()
              ? undefined
              : filtro === "prontos"
                ? painel.semPerfil > 0
                  ? `${painel.semPerfil} contato(s) ainda não têm perfil de busca preenchido — é o que falta para o cruzamento acontecer.`
                  : "Assim que entrar um imóvel que case com o que alguém procura, ele aparece aqui."
                : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((item) => (
            <OportunidadeCard
              key={item.contactId}
              item={item}
              siteUrl={siteUrl}
              aberturaInicial={item.contactId === contatoDestacado}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
