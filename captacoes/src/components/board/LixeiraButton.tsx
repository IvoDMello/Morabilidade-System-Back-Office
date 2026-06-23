"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { relativo } from "@/lib/format";

interface Excluida {
  id: string;
  endereco: string;
  excluido_em: string;
}

export function LixeiraButton() {
  const [open, setOpen] = useState(false);
  const [itens, setItens] = useState<Excluida[]>([]);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function carregar() {
    setCarregando(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("captacao")
      .select("id, endereco, excluido_em")
      .not("excluido_em", "is", null)
      .order("excluido_em", { ascending: false });
    setItens((data ?? []) as Excluida[]);
    setCarregando(false);
  }

  async function restaurar(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("captacao").update({ excluido_em: null }).eq("id", id);
    if (error) {
      toast.error("Não foi possível restaurar.");
      return;
    }
    setItens((l) => l.filter((x) => x.id !== id));
    toast.success("Captação restaurada.");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) carregar();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Lixeira"
          className="text-secondary-foreground hover:bg-secondary-foreground/10"
        >
          <Trash className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lixeira</DialogTitle>
        </DialogHeader>

        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma captação excluída.</p>
        ) : (
          <ul className="space-y-2">
            {itens.map((it) => (
              <li key={it.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{it.endereco}</p>
                  <p className="text-xs text-muted-foreground">excluída {relativo(it.excluido_em)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => restaurar(it.id)}>
                  <RotateCcw className="h-4 w-4" /> Restaurar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
