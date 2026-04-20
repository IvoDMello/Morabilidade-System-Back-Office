"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ClienteForm, type ClienteFormData } from "@/components/clientes/cliente-form";
import type { Cliente } from "@/types";

export default function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loadingDados, setLoadingDados] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregarCliente = useCallback(async () => {
    try {
      const res = await api.get<Cliente>(`/clientes/${id}`);
      setCliente(res.data);
    } catch {
      toast.error("Cliente não encontrado.");
      router.push("/clientes");
    } finally {
      setLoadingDados(false);
    }
  }, [id, router]);

  useEffect(() => {
    carregarCliente();
  }, [carregarCliente]);

  async function handleSubmit(data: ClienteFormData) {
    setSalvando(true);
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
      await api.put(`/clientes/${id}`, payload);
      toast.success("Cliente atualizado com sucesso!");
      carregarCliente();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao salvar. Verifique os dados.";
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  if (loadingDados) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-slate-400 text-sm">
        <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
        Carregando cliente...
      </div>
    );
  }

  if (!cliente) return null;

  const defaultValues: Partial<ClienteFormData> = {
    nome_completo: cliente.nome_completo,
    email: cliente.email,
    telefone: cliente.telefone,
    cpf_cnpj: cliente.cpf_cnpj ?? "",
    data_nascimento: cliente.data_nascimento ?? "",
    telefone_secundario: cliente.telefone_secundario ?? "",
    endereco: cliente.endereco ?? "",
    cidade: cliente.cidade ?? "",
    estado: cliente.estado ?? "",
    profissao_empresa: cliente.profissao_empresa ?? "",
    origem_lead: cliente.origem_lead ?? "",
    corretor_id: cliente.corretor_id ?? "",
    status: cliente.status ?? "",
    tipo_cliente: cliente.tipo_cliente ?? "",
    renda_aproximada: cliente.renda_aproximada ?? null,
    como_conheceu: cliente.como_conheceu ?? "",
    observacoes: cliente.observacoes ?? "",
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/clientes"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">Editar cliente</h1>
          <p className="text-slate-500 text-sm truncate">{cliente.email}</p>
        </div>
      </div>

      <ClienteForm
        key={cliente.id}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isLoading={salvando}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
