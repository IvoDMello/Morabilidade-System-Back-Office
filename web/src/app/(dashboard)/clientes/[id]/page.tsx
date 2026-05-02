"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ClienteForm, type ClienteFormData } from "@/components/clientes/cliente-form";
import { PreferenciaForm } from "@/components/clientes/preferencia-form";
import { MatchesCliente } from "@/components/clientes/matches-cliente";
import type { Cliente } from "@/types";

export default function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loadingDados, setLoadingDados] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [matchesKey, setMatchesKey] = useState(0);

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
        email: data.email || null,
        cpf_cnpj: data.cpf_cnpj || null,
        telefone_secundario: data.telefone_secundario || null,
        instagram: data.instagram || null,
        endereco: data.endereco || null,
        cidade: data.cidade || null,
        estado: data.estado || null,
        pais: data.estado === "EX" ? data.pais || null : null,
        origem_lead: data.origem_lead || null,
        corretor_id: data.corretor_id || null,
        status: data.status || null,
        tipo_cliente: data.tipo_cliente || null,
        como_conheceu: data.como_conheceu || null,
        observacoes: data.observacoes || null,
        imovel_codigo:
          data.tipo_cliente === "proprietario" ? data.imovel_codigo?.trim() || null : null,
        tag_ids: data.tag_ids ?? [],
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
        <div className="w-4 h-4 border-2 border-slate-200 border-t-[#585a4f] rounded-full animate-spin" />
        Carregando cliente...
      </div>
    );
  }

  if (!cliente) return null;

  const defaultValues: Partial<ClienteFormData> = {
    nome_completo: cliente.nome_completo,
    email: cliente.email ?? "",
    telefone: cliente.telefone,
    cpf_cnpj: cliente.cpf_cnpj ?? "",
    telefone_secundario: cliente.telefone_secundario ?? "",
    instagram: cliente.instagram ?? "",
    endereco: cliente.endereco ?? "",
    cidade: cliente.cidade ?? "",
    estado: cliente.estado ?? "",
    pais: cliente.pais ?? "",
    origem_lead: cliente.origem_lead ?? "",
    corretor_id: cliente.corretor_id ?? "",
    status: cliente.status ?? "",
    tipo_cliente: cliente.tipo_cliente ?? "",
    como_conheceu: cliente.como_conheceu ?? "",
    observacoes: cliente.observacoes ?? "",
    imovel_codigo: cliente.imovel_codigo ?? "",
    tag_ids: cliente.tags?.map((t) => t.id) ?? [],
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
          <p className="text-slate-500 text-sm truncate">{cliente.email || cliente.telefone}</p>
        </div>
      </div>

      <ClienteForm
        key={cliente.id}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isLoading={salvando}
        submitLabel="Salvar alterações"
      />

      {/* Preferências de imóvel */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">
            Preferências de imóvel
          </h2>
          <span className="text-xs text-slate-400">
            · o que este cliente está procurando
          </span>
        </div>
        <PreferenciaForm clienteId={cliente.id} onSaved={() => setMatchesKey((k) => k + 1)} />
      </div>

      {/* Oportunidades (matches) */}
      <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-700">Oportunidades</h2>
          <span className="text-xs text-slate-400">
            · imóveis disponíveis que casam com a preferência
          </span>
        </div>
        <MatchesCliente
          key={matchesKey}
          clienteId={cliente.id}
          clienteNome={cliente.nome_completo}
          clienteTelefone={cliente.telefone}
        />
      </div>
    </div>
  );
}
