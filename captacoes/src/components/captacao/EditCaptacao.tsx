"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CaptacaoForm } from "./CaptacaoForm";
import { createClient } from "@/lib/supabase/client";
import type { CaptacaoInput } from "@/lib/schemas";
import type { Captacao } from "@/types";

export function EditCaptacao({ captacao }: { captacao: Captacao }) {
  const router = useRouter();

  async function salvar(data: CaptacaoInput) {
    const supabase = createClient();
    const { error } = await supabase.from("captacao").update(data).eq("id", captacao.id);
    if (error) {
      toast.error("Erro ao salvar.");
      return;
    }
    toast.success("Captação atualizada.");
    router.refresh();
  }

  return (
    <CaptacaoForm
      defaultValues={{
        endereco: captacao.endereco,
        quartos: captacao.quartos,
        suites: captacao.suites,
        banheiros: captacao.banheiros,
        vagas: captacao.vagas,
        metragem: captacao.metragem,
        tipo_portaria: captacao.tipo_portaria,
        proprietario_nome: captacao.proprietario_nome,
        whatsapp: captacao.whatsapp,
        anuncio_url: captacao.anuncio_url,
        valor_venda: captacao.valor_venda,
        valor_condominio: captacao.valor_condominio,
        valor_iptu: captacao.valor_iptu,
        observacoes: captacao.observacoes,
        pendencias: captacao.pendencias,
      }}
      onSubmit={salvar}
    />
  );
}
