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
    router.push("/board");
    router.refresh();
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" /> Excluir
        </Button>
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
