"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertTriangle, ExternalLink } from "lucide-react";
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
import { dataCurta } from "@/lib/format";
import type { CaptacaoInput } from "@/lib/schemas";
import { STATUS_LABEL, type Captacao, type Status } from "@/types";

interface Duplicada {
  id: string;
  endereco: string;
  status: Status;
  decisao: string | null;
  criado_em: string;
  excluido_em: string | null;
}

export function NovaCaptacaoButton({ trigger }: { trigger?: ReactNode } = {}) {
  const [open, setOpen] = useState(false);
  const [fotos, setFotos] = useState<File[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  // Duplicadas encontradas + dados aguardando confirmação do usuário.
  const [duplicadas, setDuplicadas] = useState<Duplicada[] | null>(null);
  const [pendente, setPendente] = useState<CaptacaoInput | null>(null);
  const router = useRouter();
  const { byStatus, upsert } = useBoard();

  function reset() {
    setFotos([]);
    setDocs([]);
    setDuplicadas(null);
    setPendente(null);
  }

  /** Antes de criar: procura captações com o mesmo telefone ou anúncio. */
  async function handleSubmit(data: CaptacaoInput) {
    if (data.whatsapp || data.anuncio_url) {
      const supabase = createClient();
      const { data: rows, error } = await supabase.rpc("buscar_duplicadas", {
        p_whatsapp: data.whatsapp ?? null,
        p_anuncio_url: data.anuncio_url ?? null,
      });
      // Checagem é best effort: se a RPC falhar, não bloqueia o cadastro.
      if (!error && rows && rows.length > 0) {
        setDuplicadas(rows as Duplicada[]);
        setPendente(data);
        return;
      }
    }
    await handleCreate(data);
  }

  async function handleCreate(data: CaptacaoInput) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const primeira = byStatus.novas[0]?.ordem ?? null;
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
          <DialogTitle>{duplicadas ? "Possível duplicada" : "Nova captação"}</DialogTitle>
        </DialogHeader>

        {duplicadas && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Já existe captação com esse telefone ou anúncio. Confira antes de cadastrar de
                novo — pode ser o mesmo imóvel.
              </p>
            </div>

            <ul className="space-y-2">
              {duplicadas.map((d) => (
                <li key={d.id} className="rounded-lg border p-3 text-sm">
                  <a
                    href={`/captacao/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium hover:underline"
                  >
                    {d.endereco} <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {STATUS_LABEL[d.status]}
                    {d.decisao ? ` · ${d.decisao}` : ""}
                    {" · criada em "}
                    {dataCurta(d.criado_em)}
                    {d.excluido_em ? " · na lixeira" : ""}
                  </p>
                </li>
              ))}
            </ul>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDuplicadas(null)}>
                Voltar e revisar
              </Button>
              <Button onClick={() => pendente && handleCreate(pendente)}>
                Cadastrar mesmo assim
              </Button>
            </div>
          </div>
        )}

        {/* Form fica montado (só oculto) para não perder o que foi digitado. */}
        <div className={duplicadas ? "hidden" : "space-y-4"}>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-sm font-medium">Fotos e documentos</p>
            <AnexosPicker fotos={fotos} setFotos={setFotos} docs={docs} setDocs={setDocs} />
          </div>

          <CaptacaoForm onSubmit={handleSubmit} submitLabel="Criar captação" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
