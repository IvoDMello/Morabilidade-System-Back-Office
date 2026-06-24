"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CaptacaoForm } from "./CaptacaoForm";
import { AnexosPicker } from "./AnexosPicker";
import { createClient } from "@/lib/supabase/client";
import { uploadFoto, uploadDocumento } from "@/lib/storage";
import { orderBetween } from "@/lib/order";
import { useBoard } from "@/stores/board";
import type { CaptacaoInput } from "@/lib/schemas";
import type { Captacao } from "@/types";

export function NovaCaptacaoButton({ trigger }: { trigger?: ReactNode } = {}) {
  const [open, setOpen] = useState(false);
  const [fotos, setFotos] = useState<File[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  const router = useRouter();
  const { byStatus, upsert } = useBoard();

  function reset() {
    setFotos([]);
    setDocs([]);
  }

  async function handleCreate(data: CaptacaoInput) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const primeira = byStatus.aguardando_informacoes[0]?.ordem ?? null;
    const ordem = orderBetween(null, primeira);

    const { data: row, error } = await supabase
      .from("captacao")
      .insert({ ...data, ordem, criado_por: user?.id ?? null })
      .select()
      .single();

    if (error || !row) {
      toast.error(error?.message ?? "Não foi possível criar a captação.");
      return;
    }

    const id = (row as Captacao).id;
    let capaPath: string | null = null;

    try {
      // fotos: comprime no cliente e sobe direto; 1ª vira capa
      for (const file of fotos) {
        const paths = await uploadFoto(id, file);
        await supabase.from("midia").insert({ captacao_id: id, tipo: "foto", ...paths });
        if (!capaPath) capaPath = paths.thumb_path;
      }
      // documentos
      for (const file of docs) {
        const meta = await uploadDocumento(id, file);
        await supabase.from("documento").insert({ captacao_id: id, ...meta });
      }
      if (capaPath) {
        await supabase.from("captacao").update({ capa_path: capaPath }).eq("id", id);
      }
    } catch {
      toast.warning("Captação criada, mas houve falha em algum anexo.");
    }

    upsert({ ...(row as Captacao), capa_path: capaPath });
    reset();
    setOpen(false);
    toast.success("Captação criada.");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova captação</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova captação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-sm font-medium">Fotos e documentos</p>
            <AnexosPicker fotos={fotos} setFotos={setFotos} docs={docs} setDocs={setDocs} />
          </div>

          <CaptacaoForm onSubmit={handleCreate} submitLabel="Criar captação" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
