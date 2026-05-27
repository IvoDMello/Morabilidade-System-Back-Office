"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { LocacaoForm, type LocacaoFormData } from "@/components/locacoes/locacao-form";

export default function NovoContratoPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(data: LocacaoFormData) {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        numero_iptu: data.numero_iptu || null,
        dados_cobranca_pix: data.dados_cobranca_pix || null,
        dados_cobranca_banco: data.dados_cobranca_banco || null,
        dados_cobranca_agencia: data.dados_cobranca_agencia || null,
        dados_cobranca_conta: data.dados_cobranca_conta || null,
        observacoes_demonstrativo: data.observacoes_demonstrativo || null,
        observacoes_internas: data.observacoes_internas || null,
      };
      const res = await api.post<{ id: string }>("/locacoes/", payload);
      toast.success("Contrato cadastrado com sucesso!");
      router.push(`/locacoes/${res.data.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao cadastrar contrato. Verifique os dados.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/locacoes"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo contrato de locação</h1>
          <p className="text-slate-500 text-sm">
            Cadastre as partes, vigência e valores. O demonstrativo é calculado em tempo real.
          </p>
        </div>
      </div>

      <LocacaoForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        submitLabel="Cadastrar contrato"
      />
    </div>
  );
}
