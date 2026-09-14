"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

/** Soft-delete: marca excluido_em (preserva auditoria), não apaga do banco. */
export function ExcluirCaptacao({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function excluir() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("captacao")
      .update({ excluido_em: new Date().toISOString() })
      .eq("id", id);
    setLoading(false);
    if (error) {
      toast.error("Não foi possível excluir.");
      return;
    }
    toast.success("Captação excluída.");
    router.push("/decidir");
    router.refresh();
  }

  return (
    <Dialog>
      {/* Mora no cabeçalho olive: contorno em vez de fundo, e um vermelho
          claro o bastante para ser lido ali — o destructive do tema é escuro
          demais contra o olive. */}
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 flex-none items-center gap-1.5 rounded-xl border border-[#8f6d68] px-3 text-[13px] font-semibold text-[#eaa9a3] transition-colors hover:bg-[#e0a9a9]/15"
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Excluir captação?</DialogTitle>
          <DialogDescription>
            A captação sairá do quadro. O registro é preservado para auditoria e pode ser
            recuperado pela equipe técnica.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" onClick={excluir} disabled={loading}>
            {loading ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
