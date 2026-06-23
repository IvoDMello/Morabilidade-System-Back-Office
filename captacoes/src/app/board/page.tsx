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

  return (
    <main className="flex h-dvh flex-col bg-muted/30">
      <BoardTopbar userEmail={auth.user?.email ?? "?"} total={cards.length} />
      <div className="min-h-0 flex-1 pt-4">
        <KanbanBoard initial={cards} />
      </div>
    </main>
  );
}
