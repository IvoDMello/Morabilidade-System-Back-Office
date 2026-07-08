"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, LogOut, X, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NovaCaptacaoButton } from "@/components/captacao/NovaCaptacaoButton";
import { Avatar } from "@/components/Avatar";
import { LixeiraButton } from "./LixeiraButton";
import { BoardControls } from "./BoardControls";
import { SyncIndicator } from "./SyncIndicator";
import { createClient } from "@/lib/supabase/client";
import { useBoard } from "@/stores/board";
import { filtrarCaptacoes, filtrarPorCriterios } from "@/lib/filter";
import { STATUSES, CRITERIOS_VAZIO } from "@/types";

export function BoardTopbar({
  userEmail,
  userNome,
  total,
}: {
  userEmail: string;
  userNome: string;
  total: number;
}) {
  const router = useRouter();
  const { filtro, setFiltro, criterios, byStatus, opinioes } = useBoard();
  const naoLidas = Object.values(opinioes).reduce((n, o) => n + o.naoLidas, 0);

  const temCriterios = JSON.stringify(criterios) !== JSON.stringify(CRITERIOS_VAZIO);
  const filtrando = filtro.trim().length > 0 || temCriterios;
  const resultados = filtrando
    ? STATUSES.reduce((n, s) => n + filtrarPorCriterios(filtrarCaptacoes(byStatus[s], filtro), criterios).length, 0)
    : total;

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex flex-wrap items-center gap-2 border-b bg-secondary px-3 py-2.5 text-secondary-foreground sm:gap-3 sm:px-4 sm:py-3">
      <div className="flex shrink-0 items-center gap-2">
        <Image
          src="/icon.png"
          alt="Morabilidade"
          width={32}
          height={32}
          className="h-8 w-8 rounded-md"
          priority
        />
        <div className="leading-tight">
          <h1 className="text-base font-semibold">Captações</h1>
          <p className="text-xs text-secondary-foreground/70">
            {filtrando ? `${resultados} de ${total}` : `${total} no quadro`}
          </p>
        </div>
        <div className="ml-1 sm:border-l sm:border-secondary-foreground/15 sm:pl-3">
          <SyncIndicator />
        </div>
        {naoLidas > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground"
            title={`${naoLidas} opinião(ões) não lida(s) no quadro`}
          >
            <MessageSquare className="h-3 w-3" /> {naoLidas}
          </span>
        )}
      </div>

      {/* Ações: ficam à direita da marca no mobile; busca cai para a linha de baixo */}
      <div className="ml-auto flex items-center gap-1.5 sm:order-last sm:ml-0 sm:gap-2">
        <NovaCaptacaoButton />
        <LixeiraButton />
        <span title={`${userNome} · ${userEmail}`}>
          <Avatar nome={userNome} size={36} />
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={sair}
          title="Sair"
          className="text-secondary-foreground hover:bg-secondary-foreground/10"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <div className="order-last flex w-full items-center gap-1.5 sm:order-none sm:ml-auto sm:w-auto sm:flex-1 sm:justify-end">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Endereço, proprietário ou telefone…"
            className="bg-background px-8 text-foreground"
          />
          {filtrando && (
            <button
              type="button"
              onClick={() => setFiltro("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <BoardControls />
      </div>
    </header>
  );
}
