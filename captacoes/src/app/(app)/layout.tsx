import { Suspense } from "react";
import { AppShell } from "@/components/app/AppShell";
import { NovaCaptacaoDeLink } from "@/components/captacao/NovaCaptacaoDeLink";
import { createClient } from "@/lib/supabase/server";
import { contarMidia } from "@/lib/midia";
import type { Captacao, CaptacaoLista, Lista, Midia, Perfil } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Casca das quatro abas. Busca uma vez o que todas elas usam e entrega ao
 * store; trocar de aba passa a ser navegação de cliente, sem nova consulta.
 *
 * As publicadas VÊM na consulta, ainda que não apareçam em nenhuma aba (a
 * etapa delas é `publicada`): sem elas a contabilidade de gravações perderia
 * justamente os casos completos — gravada, cadastrada e publicada. Só as
 * excluídas ficam de fora; a lixeira tem consulta separada.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const [
    { data: cards },
    { data: auth },
    { data: perfis },
    { data: listas },
    { data: vinculos },
    { data: midias },
  ] = await Promise.all([
      supabase
        .from("captacao")
        .select("*")
        .is("excluido_em", null)
        .order("ordem", { ascending: true }),
      supabase.auth.getUser(),
      supabase.from("perfil").select("*"),
      supabase.from("lista").select("*").order("ordem", { ascending: true }),
      supabase.from("captacao_lista").select("*"),
      // Só as duas colunas da contagem: o selo "8 fotos" do card não precisa
      // dos caminhos no Storage, e a lista pode ser longa.
      supabase.from("midia").select("captacao_id, tipo"),
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
        midia: contarMidia((midias ?? []) as Pick<Midia, "captacao_id" | "tipo">[]),
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
