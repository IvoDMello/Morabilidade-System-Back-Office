"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { WhatsAppMessage } from "@/types/whatsapp";

/** De quanto em quanto tempo o navegador confere se algo mudou no banco. */
const CHECK_INTERVAL_MS = 4000;

/**
 * Se a conferência falhar (sem sessão no navegador, rede fora), a tela ainda
 * se atualiza, só que mais devagar, para não congelar sem ninguém perceber.
 */
const FALLBACK_REFRESH_MS = 30_000;

/** Quantas mensagens recentes da conversa aberta entram na conferência dos tiques. */
const RECENT_MESSAGES = 20;

const USA_SUPABASE = process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase";

/**
 * Mantém o inbox atualizado sem recarregar a página à toa.
 *
 * Antes, a conversa aberta chamava router.refresh() a cada 4s. Cada refresh
 * refaz a página inteira no servidor da Vercel (login + ~10 consultas), umas
 * 900 vezes por hora por aba aberta, e isso estourou a cota de CPU do plano
 * (deploy pausado em 11/11/2026).
 *
 * Agora o navegador pergunta direto ao Supabase, com duas consultas mínimas,
 * se algo mudou, e só chama router.refresh() quando mudou:
 *  - `updated_at` mais recente das conversas: o trigger o atualiza em qualquer
 *    mudança (mensagem nova, não lidas, status, fixar, triagem);
 *  - id + status das últimas mensagens da conversa aberta: pega os tiques de
 *    entregue/lido, que o webhook grava só na mensagem.
 *
 * O acesso pelo navegador usa a sessão do login, e a RLS (0012/0024) libera
 * leitura para usuário autenticado.
 */
export function useRefreshOnChanges({
  inboxVersion,
  messages,
}: {
  /** Maior `updatedAt` da lista de conversas que a tela está mostrando. */
  inboxVersion: string | null;
  /** Mensagens da conversa aberta, como vieram do servidor. */
  messages: WhatsAppMessage[];
}) {
  const router = useRouter();

  // O que está na tela agora. Ref para o intervalo ler sempre o último render
  // sem precisar ser recriado a cada refresh.
  const shownRef = useRef({ inboxVersion, messages });
  useEffect(() => {
    shownRef.current = { inboxVersion, messages };
  }, [inboxVersion, messages]);

  useEffect(() => {
    // Modo mock (dev local): não há banco para consultar, mantém o refresh fixo.
    if (!USA_SUPABASE) {
      const interval = setInterval(() => {
        if (!document.hidden) router.refresh();
      }, CHECK_INTERVAL_MS);
      return () => clearInterval(interval);
    }

    const db = getSupabaseBrowserClient().schema("whatsapp");
    let cancelled = false;
    let checking = false;
    // Estado do banco que já disparou um refresh. Cada estado novo recarrega no
    // máximo uma vez, então nunca entra em loop, mesmo se a tela e o banco
    // não baterem por algum motivo.
    let refreshedFor: string | null = null;
    let lastFallbackAt = Date.now();

    function fallbackRefresh() {
      if (Date.now() - lastFallbackAt < FALLBACK_REFRESH_MS) return;
      lastFallbackAt = Date.now();
      router.refresh();
    }

    async function check() {
      if (cancelled || checking || document.hidden) return;
      checking = true;
      try {
        const shown = shownRef.current;
        const conversationId = shown.messages[0]?.conversationId ?? null;

        const [inbox, recent] = await Promise.all([
          db
            .from("whatsapp_conversations")
            .select("updated_at")
            .order("updated_at", { ascending: false })
            .limit(1),
          conversationId
            ? db
                .from("whatsapp_messages")
                .select("id, status")
                .eq("conversation_id", conversationId)
                .order("wa_timestamp", { ascending: false })
                .limit(RECENT_MESSAGES)
            : null,
        ]);
        if (cancelled) return;

        const dbVersion: string | null = inbox.data?.[0]?.updated_at ?? null;
        // Erro, ou a tela tem conversas e o banco não devolveu nenhuma: a RLS
        // escondeu tudo (sessão expirada no navegador). Não dá para confiar.
        if (inbox.error || recent?.error || (shown.inboxVersion && !dbVersion)) {
          fallbackRefresh();
          return;
        }

        const recentRows: { id: string; status: string }[] = recent?.data ?? [];
        const shownStatus = new Map(shown.messages.map((m) => [m.id, m.status]));
        const messagesChanged =
          recentRows.some((r) => shownStatus.get(r.id) !== r.status) ||
          // Conversa limpa: a tela tem mensagens e o banco não tem mais.
          (conversationId !== null && recentRows.length === 0);
        const inboxChanged = dbVersion !== null && dbVersion !== shown.inboxVersion;

        if (!inboxChanged && !messagesChanged) return;

        const dbState = `${dbVersion}|${recentRows.map((r) => `${r.id}:${r.status}`).join(",")}`;
        if (dbState === refreshedFor) return;
        refreshedFor = dbState;
        router.refresh();
      } catch {
        fallbackRefresh();
      } finally {
        checking = false;
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    // Voltou para a aba: confere na hora em vez de esperar o próximo ciclo.
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
}
