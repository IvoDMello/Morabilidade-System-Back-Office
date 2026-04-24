"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, X, ImageOff } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ImovelForm, type ImovelFormData } from "@/components/imoveis/imovel-form";

export default function NovoImovelPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFotos, setPendingFotos] = useState<File[]>([]);

  const onDrop = useCallback((accepted: File[]) => {
    setPendingFotos((prev) => {
      const total = prev.length + accepted.length;
      if (total > 30) {
        toast.error(`Limite de 30 fotos. Você pode adicionar ainda ${30 - prev.length}.`);
        return [...prev, ...accepted.slice(0, 30 - prev.length)];
      }
      return [...prev, ...accepted];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    disabled: pendingFotos.length >= 30,
  });

  function removerFoto(index: number) {
    setPendingFotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(data: ImovelFormData) {
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        corretor_id: data.corretor_id || null,
        mobiliado: data.mobiliado || null,
        codigo: data.codigo || undefined,
      };

      const res = await api.post<{ id: string }>("/imoveis/", payload);
      const imovelId = res.data.id;

      if (pendingFotos.length > 0) {
        try {
          const formData = new FormData();
          pendingFotos.forEach((f) => formData.append("fotos", f));
          await api.post(`/imoveis/${imovelId}/fotos`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch (err: unknown) {
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          toast.warning(`Imóvel cadastrado, mas houve um erro ao enviar as fotos: ${detail ?? "tente adicioná-las na edição."}`);
          router.push(`/imoveis/${imovelId}`);
          return;
        }
      }

      toast.success("Imóvel cadastrado com sucesso!");
      router.push(`/imoveis/${imovelId}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = axiosErr?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Erro ao cadastrar imóvel. Verifique os dados.";
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

      {/* Seção de fotos */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 p-6">
        <div className="pb-2 mb-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Fotos</h3>
          <span className="text-xs text-slate-400">{pendingFotos.length}/30</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          As fotos serão enviadas automaticamente ao cadastrar o imóvel.
        </p>

        {/* Dropzone */}
        {pendingFotos.length < 30 && (
          <div
            {...getRootProps()}
            className={`mb-4 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
              isDragActive
                ? "border-[#585a4f] bg-[#585a4f]/5"
                : "border-slate-200 hover:border-[#585a4f]/40 hover:bg-slate-50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Upload className="w-6 h-6" />
              <p className="text-sm font-medium text-slate-600">
                {isDragActive ? "Solte as fotos aqui" : "Clique ou arraste fotos aqui"}
              </p>
              <p className="text-xs">JPEG, PNG, WebP · Até {30 - pendingFotos.length} foto{30 - pendingFotos.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        )}

        {/* Pré-visualização */}
        {pendingFotos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-slate-300">
            <ImageOff className="w-7 h-7" />
            <p className="text-sm">Nenhuma foto selecionada</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {pendingFotos.map((file, index) => (
              <div key={index} className="relative group aspect-square">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Foto ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg border border-slate-100"
                />
                {index === 0 && (
                  <div className="absolute top-1 left-1 bg-amber-400 text-white text-xs px-1.5 py-0.5 rounded-md font-medium shadow text-[10px]">
                    Capa
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removerFoto(index)}
                  className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
