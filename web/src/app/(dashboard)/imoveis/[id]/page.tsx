"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Trash2, Star, Loader2, ImageOff } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ImovelForm, type ImovelFormData } from "@/components/imoveis/imovel-form";
import type { Imovel, Foto } from "@/types";

// ── Galeria de fotos ──────────────────────────────────────────────────────────

function GaleriaFotos({ imovelId, fotos, onAtualizar }: {
  imovelId: string;
  fotos: Foto[];
  onAtualizar: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);

  const onDrop = useCallback(
    async (files: File[]) => {
      if (fotos.length + files.length > 30) {
        toast.error(`Limite de 30 fotos. Você pode adicionar ainda ${30 - fotos.length}.`);
        return;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        files.forEach((f) => formData.append("fotos", f));
        await api.post(`/imoveis/${imovelId}/fotos`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success(`${files.length} foto${files.length > 1 ? "s" : ""} enviada${files.length > 1 ? "s" : ""} com sucesso.`);
        onAtualizar();
      } catch {
        toast.error("Erro ao enviar fotos. Verifique o tamanho (máx. 1,5 MB cada).");
      } finally {
        setUploading(false);
      }
    },
    [imovelId, fotos.length, onAtualizar]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    disabled: uploading || fotos.length >= 30,
  });

  async function deletarFoto(fotoId: string) {
    if (!confirm("Excluir esta foto?")) return;
    setDeletandoId(fotoId);
    try {
      await api.delete(`/imoveis/${imovelId}/fotos/${fotoId}`);
      toast.success("Foto excluída.");
      onAtualizar();
    } catch {
      toast.error("Erro ao excluir foto.");
    } finally {
      setDeletandoId(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="pb-2 mb-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Fotos</h3>
          <span className="text-xs text-slate-400">{fotos.length}/30</span>
        </div>
      </div>

      {/* Dropzone */}
      {fotos.length < 30 && (
        <div
          {...getRootProps()}
          className={`mb-4 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
            isDragActive
              ? "border-blue-400 bg-blue-50"
              : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-blue-600">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm font-medium">Enviando fotos...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Upload className="w-6 h-6" />
              <p className="text-sm font-medium text-slate-600">
                {isDragActive ? "Solte as fotos aqui" : "Clique ou arraste fotos aqui"}
              </p>
              <p className="text-xs">JPEG, PNG, WebP · Máx. 1,5 MB cada · Até {30 - fotos.length} foto{30 - fotos.length !== 1 ? "s" : ""}</p>
            </div>
          )}
        </div>
      )}

      {/* Grid de fotos */}
      {fotos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-slate-300">
          <ImageOff className="w-8 h-8" />
          <p className="text-sm">Nenhuma foto cadastrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {fotos.map((foto, index) => (
            <div key={foto.id} className="relative group aspect-square">
              <img
                src={foto.url}
                alt={`Foto ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border border-slate-100"
              />
              {/* Badge de capa */}
              {index === 0 && (
                <div className="absolute top-1 left-1 flex items-center gap-0.5 bg-amber-400 text-white text-xs px-1.5 py-0.5 rounded-md font-medium shadow">
                  <Star className="w-3 h-3 fill-current" />
                  Capa
                </div>
              )}
              {/* Botão excluir */}
              <button
                onClick={() => deletarFoto(foto.id)}
                disabled={deletandoId === foto.id}
                className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                title="Excluir foto"
              >
                {deletandoId === foto.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function EditarImovelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [imovel, setImovel] = useState<Imovel | null>(null);
  const [loadingDados, setLoadingDados] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregarImovel = useCallback(async () => {
    try {
      const res = await api.get<Imovel>(`/imoveis/${id}`);
      setImovel(res.data);
    } catch {
      toast.error("Imóvel não encontrado.");
      router.push("/imoveis");
    } finally {
      setLoadingDados(false);
    }
  }, [id, router]);

  useEffect(() => {
    carregarImovel();
  }, [carregarImovel]);

  async function handleSubmit(data: ImovelFormData) {
    setSalvando(true);
    try {
      const payload = {
        ...data,
        corretor_id: data.corretor_id || null,
        mobiliado: data.mobiliado || null,
      };
      await api.put(`/imoveis/${id}`, payload);
      toast.success("Imóvel atualizado com sucesso!");
      carregarImovel();
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
        Carregando imóvel...
      </div>
    );
  }

  if (!imovel) return null;

  // Monta defaultValues a partir do imóvel carregado
  const defaultValues: Partial<ImovelFormData> = {
    codigo: imovel.codigo,
    tipo_negocio: imovel.tipo_negocio,
    disponibilidade: imovel.disponibilidade,
    condicao: imovel.condicao,
    cep: imovel.cep ?? "",
    logradouro: imovel.logradouro,
    numero: imovel.numero ?? "",
    complemento: imovel.complemento ?? "",
    bairro: imovel.bairro,
    cidade: imovel.cidade,
    tipo_imovel: imovel.tipo_imovel,
    dormitorios: imovel.dormitorios ?? null,
    suites: imovel.suites ?? null,
    banheiros: imovel.banheiros ?? null,
    vagas_garagem: imovel.vagas_garagem ?? null,
    mobiliado: imovel.mobiliado ?? null,
    andar: imovel.andar ?? null,
    area_total: imovel.area_total ?? null,
    area_util: imovel.area_util ?? null,
    valor_venda: imovel.valor_venda ?? null,
    valor_locacao: imovel.valor_locacao ?? null,
    iptu_mensal: imovel.iptu_mensal ?? null,
    condominio_mensal: imovel.condominio_mensal ?? null,
    descricao: imovel.descricao ?? "",
    video_url: imovel.video_url ?? "",
    corretor_id: imovel.corretor_id ?? null,
    tag_ids: imovel.tags?.map((t) => t.id) ?? [],
  };

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/imoveis"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">Editar imóvel</h1>
            <span className="font-mono text-sm font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              {imovel.codigo}
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            {imovel.logradouro}{imovel.numero ? `, ${imovel.numero}` : ""} — {imovel.bairro}, {imovel.cidade}
          </p>
        </div>
      </div>

      {/* Formulário de dados */}
      <ImovelForm
        key={imovel.id}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isLoading={salvando}
        submitLabel="Salvar alterações"
      />

      {/* Galeria de fotos */}
      <div className="mt-8">
        <GaleriaFotos
          imovelId={id}
          fotos={imovel.fotos ?? []}
          onAtualizar={carregarImovel}
        />
      </div>
    </div>
  );
}
