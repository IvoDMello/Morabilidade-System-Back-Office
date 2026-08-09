import { Suspense } from "react";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { BoardTopbar } from "@/components/board/BoardTopbar";
import { NovaCaptacaoDeLink } from "@/components/captacao/NovaCaptacaoDeLink";
import { createClient } from "@/lib/supabase/server";
import type { Captacao, Perfil } from "@/types";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const supabase = await createClient();

  const [{ data }, { data: auth }, { data: perfis }] = await Promise.all([
    supabase
      .from("captacao")
      .select("*")
      .is("excluido_em", null)
      .neq("status", "publicada")
      .order("ordem", { ascending: true }),
    supabase.auth.getUser(),
    supabase.from("perfil").select("*"),
  ]);

  const cards = (data ?? []) as Captacao[];

  const userEmail = auth.user?.email ?? "?";
  const meuPerfil = (perfis as Perfil[] | null)?.find((p) => p.user_id === auth.user?.id);
  // Nome de exibição do perfil; sem perfil ainda, cai no e-mail.
  const userNome = meuPerfil?.nome ?? userEmail;

  return (
    <main className="flex h-dvh flex-col bg-muted/30">
      {/* Desktop usa a topbar clássica; o mobile traz o próprio hero no board. */}
      <div className="hidden lg:block">
        <BoardTopbar userEmail={userEmail} userNome={userNome} total={cards.length} />
      </div>
      <div className="min-h-0 flex-1 lg:pt-4">
        <KanbanBoard initial={cards} userEmail={userEmail} userNome={userNome} />
      </div>
      {/* Captação chegando por link (copiloto do WhatsApp). Suspense porque lê
          searchParams no cliente. */}
      <Suspense fallback={null}>
        <NovaCaptacaoDeLink />
      </Suspense>
    </main>
  );
}
