"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ClienteForm, type ClienteFormData } from "@/components/clientes/cliente-form";

export default function NovoClientePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(data: ClienteFormData) {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        cpf_cnpj: data.cpf_cnpj || null,
        data_nascimento: data.data_nascimento || null,
        telefone_secundario: data.telefone_secundario || null,
        endereco: data.endereco || null,
        cidade: data.cidade || null,
        estado: data.estado || null,
        profissao_empresa: data.profissao_empresa || null,
        origem_lead: data.origem_lead || null,
        corretor_id: data.corretor_id || null,
        status: data.status || null,
        tipo_cliente: data.tipo_cliente || null,
        como_conheceu: data.como_conheceu || null,
        observacoes: data.observacoes || null,
      };
      const res = await api.post<{ id: string }>("/clientes/", payload);
      toast.success("Cliente cadastrado com sucesso!");
      router.push(`/clientes/${res.data.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao cadastrar cliente. Verifique os dados.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/clientes"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo cliente</h1>
          <p className="text-slate-500 text-sm">Preencha os dados do cliente ou lead.</p>
        </div>
      </div>

      <ClienteForm onSubmit={handleSubmit} isLoading={isLoading} submitLabel="Cadastrar cliente" />
    </div>
  );
}
