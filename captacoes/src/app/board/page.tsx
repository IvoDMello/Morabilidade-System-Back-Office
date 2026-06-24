import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { BoardTopbar } from "@/components/board/BoardTopbar";
import { createClient } from "@/lib/supabase/server";
import type { Captacao } from "@/types";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const supabase = await createClient();

  const [{ data }, { data: auth }] = await Promise.all([
    supabase.from("captacao").select("*").is("excluido_em", null).order("ordem", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  const cards = (data ?? []) as Captacao[];

  const userEmail = auth.user?.email ?? "?";

  return (
    <main className="flex h-dvh flex-col bg-muted/30">
      {/* Desktop usa a topbar clássica; o mobile traz o próprio hero no board. */}
      <div className="hidden lg:block">
        <BoardTopbar userEmail={userEmail} total={cards.length} />
      </div>
      <div className="min-h-0 flex-1 lg:pt-4">
        <KanbanBoard initial={cards} userEmail={userEmail} />
      </div>
    </main>
  );
}
