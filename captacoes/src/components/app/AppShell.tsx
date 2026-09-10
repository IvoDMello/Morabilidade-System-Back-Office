"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchOpinioesResumo } from "@/lib/opinioes";
import { useApp } from "@/stores/app";
import { contadores, hojeLocal } from "@/lib/contadores";
import type { Captacao, CaptacaoLista, Lista, Perfil } from "@/types";
import type { MidiaResumo } from "@/lib/midia";
import { TabBar } from "./TabBar";

export interface DadosIniciais {
  cards: Captacao[];
  listas: Lista[];
  vinculos: CaptacaoLista[];
  perfis: Perfil[];
  midia: Record<string, MidiaResumo>;
  userId: string;
  userNome: string;
}

/**
 * Casca do app: hidrata o store com o que o servidor buscou, mantém o tempo
 * real ligado e desenha a barra de abas. Cada aba é uma rota própria que lê
 * do store — assim trocar de aba não refaz as consultas.
 */
export function AppShell({ inicial, children }: { inicial: DadosIniciais; children: React.ReactNode }) {
  const hidratar = useApp((s) => s.hidratar);
  const upsert = useApp((s) => s.upsert);
  const remove = useApp((s) => s.remove);
  const setConexao = useApp((s) => s.setConexao);
  const setOpinioes = useApp((s) => s.setOpinioes);
  const cards = useApp((s) => s.cards);
  const userId = useApp((s) => s.userId);

  // O servidor é a fonte da verdade a cada navegação; o store só reflete.
  useEffect(() => hidratar(inicial), [inicial, hidratar]);

  // Trava a rolagem do documento enquanto o app está na tela: a casca já ocupa
  // a viewport inteira e cada aba tem seu próprio container rolável. Sem isto o
  // corpo ganha uma rolagem residual de alguns pixels no celular e a TabBar do
  // rodapé sobe junto com o conteúdo (ver `.app-fixo` no globals.css).
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.add("app-fixo");
    return () => raiz.classList.remove("app-fixo");
  }, []);

  // Realtime das captações: o quadro é usado a quatro mãos.
  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("app-captacoes")
      .on("postgres_changes", { event: "*", schema: "captacoes", table: "captacao" }, (payload) => {
        if (payload.eventType === "DELETE") {
          remove((payload.old as Captacao).id);
          return;
        }
        const row = payload.new as Captacao;
        // Excluída sai de todas as abas; publicada tem tela própria.
        if (row.excluido_em) remove(row.id);
        else upsert(row);
      })
      .subscribe((status) => {
        setConexao(status === "SUBSCRIBED" ? "online" : status === "CHANNEL_ERROR" ? "offline" : "conectando");
      });

    return () => {
      supabase.removeChannel(canal);
    };
  }, [upsert, remove, setConexao]);

  // Realtime das listas e dos vínculos: criar/renomear lista aparece na hora.
  const recarregarListas = useRef<() => void>(() => {});
  useEffect(() => {
    const supabase = createClient();

    recarregarListas.current = async () => {
      const [{ data: listas }, { data: vinculos }] = await Promise.all([
        supabase.from("lista").select("*").order("ordem", { ascending: true }),
        supabase.from("captacao_lista").select("*"),
      ]);
      useApp.setState({
        listas: (listas ?? []) as Lista[],
        vinculos: (vinculos ?? []) as CaptacaoLista[],
      });
    };

    const canal = supabase
      .channel("app-listas")
      .on("postgres_changes", { event: "*", schema: "captacoes", table: "lista" }, () =>
        recarregarListas.current()
      )
      .on("postgres_changes", { event: "*", schema: "captacoes", table: "captacao_lista" }, () =>
        recarregarListas.current()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  // Badges de opinião: recarrega ao voltar para a aba e quando alguém comenta.
  useEffect(() => {
    let ativo = true;
    const carregar = () => fetchOpinioesResumo().then((o) => ativo && setOpinioes(o));
    carregar();
    const aoFocar = () => {
      if (document.visibilityState === "visible") carregar();
    };
    document.addEventListener("visibilitychange", aoFocar);

    const supabase = createClient();
    const canal = supabase
      .channel("app-opinioes")
      .on("postgres_changes", { event: "*", schema: "captacoes", table: "opiniao" }, carregar)
      .subscribe();

    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoFocar);
      supabase.removeChannel(canal);
    };
  }, [setOpinioes]);

  const nums = useMemo(() => contadores(cards, hojeLocal(), userId), [cards, userId]);

  return (
    // `h-dvh` sozinho já serve quando `.app-fixo` ainda não entrou (primeiro
    // quadro); `max-h-full` só morde depois dela, e aí prende a casca à altura
    // exata da viewport para a TabBar nunca ser empurrada para fora.
    <div className="flex h-dvh max-h-full flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <TabBar contadores={nums} />
    </div>
  );
}
