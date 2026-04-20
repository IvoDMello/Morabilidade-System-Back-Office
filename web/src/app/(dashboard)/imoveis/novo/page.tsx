"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ImovelForm, type ImovelFormData } from "@/components/imoveis/imovel-form";

export default function NovoImovelPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(data: ImovelFormData) {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        // Converte strings vazias de campos opcionais para null
        corretor_id: data.corretor_id || null,
        mobiliado: data.mobiliado || null,
        codigo: data.codigo || undefined,
      };

      const res = await api.post<{ id: string }>("/imoveis/", payload);
      toast.success("Imóvel cadastrado com sucesso!");
      router.push(`/imoveis/${res.data.id}`);
    } catch (err: unknown) {
      console.error("Erro ao cadastrar imóvel:", err);
      const axiosErr = err as { response?: { status?: number; data?: { detail?: unknown } } };
      console.error("Status:", axiosErr?.response?.status);
      console.error("Detalhe:", JSON.stringify(axiosErr?.response?.data));
      const detail = axiosErr?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Erro ao cadastrar imóvel. Verifique os dados e tente novamente.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/imoveis"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novo imóvel</h1>
          <p className="text-slate-500 text-sm">Preencha os dados do imóvel para cadastrá-lo.</p>
        </div>
      </div>

      <ImovelForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        submitLabel="Cadastrar imóvel"
      />
    </div>
  );
}
