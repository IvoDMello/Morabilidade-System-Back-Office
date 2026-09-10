"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, MoreVertical, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { NovaCaptacaoButton } from "@/components/captacao/NovaCaptacaoButton";
import { PublicadasButton } from "@/components/board/PublicadasButton";
import { LixeiraButton } from "@/components/board/LixeiraButton";
import { SyncIndicator } from "@/components/board/SyncIndicator";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/stores/app";
import { CRITERIOS_VAZIO } from "@/types";
import { cn, ITEM_MENU } from "@/lib/utils";
import { NavDesktop } from "./TabBar";
import type { Contadores } from "@/lib/contadores";

/**
 * Cabeçalho olive do app. A logo fica aqui, não só no login: é o que dá cara
 * de produto da casa a uma ferramenta interna que os sócios abrem o dia todo.
 */
export function AppHeader({
  titulo,
  subtitulo,
  contadores,
  busca = true,
  onAbrirFiltros,
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  contadores: Contadores;
  busca?: boolean;
  onAbrirFiltros?: () => void;
}) {
  const router = useRouter();
  const { filtro, setFiltro, criterios, userNome } = useApp();
  const filtrosAtivos = contarCriterios(criterios);

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header
      className="flex-none px-[18px] pb-4 pt-[18px] text-[#f3f4f0]"
      style={{ background: "linear-gradient(150deg,#2c2e28 0%,#585a4f 58%,#454840 100%)" }}
    >
      <div className="mb-3.5 flex items-center justify-between gap-4">
        <Link href="/decidir" aria-label="Início">
          <Image
            src="/logo.png"
            alt="Morabilidade"
            width={512}
            height={288}
            className="h-[38px] w-auto object-contain lg:h-[44px]"
            priority
          />
        </Link>

        <NavDesktop contadores={contadores} />

        <div className="flex items-center gap-2.5">
          <SyncIndicator />
          <div className="hidden lg:block">
            <NovaCaptacaoButton />
          </div>
          <Avatar nome={userNome} size={34} />
          <MenuMais onSair={sair} />
        </div>
      </div>

      <div className="text-center lg:text-left">
        <p className="mb-1.5 text-[10.5px] font-semibold tracking-[0.2em] text-primary">CAPTAÇÕES</p>
        <h1 className="font-serif text-[27px] font-semibold leading-none tracking-[-0.01em]">{titulo}</h1>
        {subtitulo && <div className="mt-2 text-[13px] text-white/75">{subtitulo}</div>}
      </div>

      {busca && (
        <div className="mt-4 flex gap-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar por endereço…"
              aria-label="Buscar captação"
              className="h-[42px] w-full rounded-[13px] border border-white/[0.18] bg-white/[0.14] pl-10 pr-9 text-[13.5px] text-white placeholder:text-white/55 outline-none focus-visible:border-primary"
            />
            {filtro && (
              <button
                type="button"
                onClick={() => setFiltro("")}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-white/70 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {onAbrirFiltros && (
            <button
              type="button"
              onClick={onAbrirFiltros}
              aria-label={`Filtros${filtrosAtivos > 0 ? ` (${filtrosAtivos} ativos)` : ""}`}
              className={cn(
                "relative flex h-[42px] w-11 flex-none items-center justify-center rounded-[13px] border text-white",
                filtrosAtivos > 0
                  ? "border-primary bg-primary/20"
                  : "border-white/[0.18] bg-white/[0.14]"
              )}
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" />
              {filtrosAtivos > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#4b4d44] bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {filtrosAtivos}
                </span>
              )}
            </button>
          )}
        </div>
      )}
    </header>
  );
}

/** Publicadas, Lixeira e sair — acesso secundário, fora das abas. */
function MenuMais({ onSair }: { onSair: () => void }) {
  return (
    <details className="relative">
      <summary
        aria-label="Mais opções"
        className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-[10px] bg-white/[0.12] text-white/85 [&::-webkit-details-marker]:hidden"
      >
        <MoreVertical className="h-[17px] w-[17px]" />
      </summary>
      <div className="absolute right-0 top-10 z-30 flex w-56 flex-col items-stretch rounded-xl border bg-card p-2 text-foreground shadow-lg">
        <div className="mb-1 border-b pb-1 lg:hidden">
          <NovaCaptacaoButton
            trigger={
              <button type="button" className={cn(ITEM_MENU, "font-semibold")}>
                <Plus className="h-4 w-4 flex-none text-primary" strokeWidth={2.4} />
                Nova captação
              </button>
            }
          />
        </div>
        <PublicadasButton />
        <LixeiraButton />
        <button type="button" onClick={onSair} className={cn(ITEM_MENU, "mt-1 border-t pt-2.5")}>
          <LogOut className="h-4 w-4 flex-none text-muted-foreground" />
          Sair
        </button>
      </div>
    </details>
  );
}

/** Quantos filtros estão ativos — alimenta o badge do botão. */
export function contarCriterios(c: typeof CRITERIOS_VAZIO): number {
  let n = 0;
  n += c.listas.length ? 1 : 0;
  n += c.bairros.length ? 1 : 0;
  n += c.situacoes.length;
  if (c.valorMin != null || c.valorMax != null) n++;
  if (c.metragemMin != null || c.metragemMax != null) n++;
  if (c.quartosMin != null) n++;
  if (c.suitesMin != null) n++;
  if (c.vagasMin != null) n++;
  if (c.entradaDe != null || c.entradaAte != null) n++;
  return n;
}
