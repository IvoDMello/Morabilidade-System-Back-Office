"use client";

import { useState } from "react";
import { FileUp, FileText, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { uploadDocumento, signedUrl } from "@/lib/storage";
import type { Documento } from "@/types";

export function Documentos({ captacaoId, docsIniciais }: { captacaoId: string; docsIniciais: Documento[] }) {
  const [docs, setDocs] = useState<Documento[]>(docsIniciais);
  const [enviando, setEnviando] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setEnviando(true);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        const meta = await uploadDocumento(captacaoId, file);
        const { data, error } = await supabase
          .from("documento")
          .insert({ captacao_id: captacaoId, ...meta })
          .select()
          .single();
        if (error) throw error;
        setDocs((d) => [...d, data as Documento]);
      }
      toast.success("Documento(s) enviado(s).");
    } catch {
      toast.error("Falha ao enviar documento.");
    } finally {
      setEnviando(false);
    }
  }

  async function baixar(doc: Documento) {
    try {
      const url = await signedUrl(doc.storage_path, 300); // signed URL de 5 min (LGPD)
      window.open(url, "_blank");
    } catch {
      toast.error("Não foi possível gerar o link.");
    }
  }

  async function remover(doc: Documento) {
    const supabase = createClient();
    await supabase.from("documento").delete().eq("id", doc.id);
    await supabase.storage.from("captacoes").remove([doc.storage_path]);
    setDocs((d) => d.filter((x) => x.id !== doc.id));
  }

  return (
    <div className="space-y-3">
      <label className="inline-flex">
        <input type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <Button type="button" variant="outline" asChild disabled={enviando}>
          <span>
            <FileUp className="h-4 w-4" /> {enviando ? "Enviando..." : "Anexar documento"}
          </span>
        </Button>
      </label>

      <ul className="space-y-2">
        {docs.map((doc) => (
          <li key={doc.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{doc.nome_original}</span>
            <button onClick={() => baixar(doc)} aria-label="Baixar">
              <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
            <button onClick={() => remover(doc)} aria-label="Remover">
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
