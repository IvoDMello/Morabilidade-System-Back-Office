import { Suspense } from "react";
import { AppShell } from "@/components/app/AppShell";
import { NovaCaptacaoDeLink } from "@/components/captacao/NovaCaptacaoDeLink";
import { createClient } from "@/lib/supabase/server";
import type { Captacao, CaptacaoLista, Lista, Perfil } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Casca das quatro abas. Busca uma vez o que todas elas usam e entrega ao
 * store; trocar de aba passa a ser navegação de cliente, sem nova consulta.
 *
 * `publicada` fica de fora das abas (tem tela própria no menu ⋯), mas as
 * excluídas é que nunca entram — a lixeira tem consulta separada.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const [{ data: cards }, { data: auth }, { data: perfis }, { data: listas }, { data: vinculos }] =
    await Promise.all([
      supabase
        .from("captacao")
        .select("*")
        .is("excluido_em", null)
        .neq("status", "publicada")
        .order("ordem", { ascending: true }),
      supabase.auth.getUser(),
      supabase.from("perfil").select("*"),
      supabase.from("lista").select("*").order("ordem", { ascending: true }),
      supabase.from("captacao_lista").select("*"),
    ]);

  const userEmail = auth.user?.email ?? "?";
  const meuPerfil = (perfis as Perfil[] | null)?.find((p) => p.user_id === auth.user?.id);

  return (
    <AppShell
      inicial={{
        cards: (cards ?? []) as Captacao[],
        listas: (listas ?? []) as Lista[],
        vinculos: (vinculos ?? []) as CaptacaoLista[],
        perfis: (perfis ?? []) as Perfil[],
        userId: auth.user?.id ?? "",
        userNome: meuPerfil?.nome ?? userEmail,
      }}
    >
      {children}
      {/* Captação chegando por link (copiloto do WhatsApp). */}
      <Suspense fallback={null}>
        <NovaCaptacaoDeLink />
      </Suspense>
    </AppShell>
  );
}
