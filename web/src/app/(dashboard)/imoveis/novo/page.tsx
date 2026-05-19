"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, X, ImageOff, RotateCw, GripVertical } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { ImovelForm, type ImovelFormData } from "@/components/imoveis/imovel-form";
import { rotacionarArquivoImagem } from "@/lib/imagem";

const MAX_FOTOS = 30;

export default function NovoImovelPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFotos, setPendingFotos] = useState<File[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [rotacionandoIdx, setRotacionandoIdx] = useState<number | null>(null);

  // URLs de preview com lifecycle controlado (evita vazamento de ObjectURL a
  // cada re-render quando criadas inline no JSX).
  const previews = useMemo(
    () => pendingFotos.map((f) => URL.createObjectURL(f)),
    [pendingFotos]
  );
  useEffect(() => {
    return () => { previews.forEach((u) => URL.revokeObjectURL(u)); };
  }, [previews]);

  const onDrop = useCallback((accepted: File[]) => {
    setPendingFotos((prev) => {
      const espacoLivre = MAX_FOTOS - prev.length;
      if (accepted.length > espacoLivre) {
        toast.error(`Limite de ${MAX_FOTOS} fotos. Você pode adicionar ainda ${espacoLivre}.`);
        return [...prev, ...accepted.slice(0, espacoLivre)];
      }
      return [...prev, ...accepted];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    disabled: pendingFotos.length >= MAX_FOTOS,
    noClick: false,
  });

  function removerFoto(index: number) {
    setPendingFotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function rotacionarFoto(index: number) {
    setRotacionandoIdx(index);
    try {
      const original = pendingFotos[index];
      const rotated = await rotacionarArquivoImagem(original, 90);
      setPendingFotos((prev) => prev.map((f, i) => (i === index ? rotated : f)));
    } catch (err) {
      console.error("[rotacionar foto]", err);
      toast.error("Não foi possível girar a foto. Tente novamente.");
    } finally {
      setRotacionandoIdx(null);
    }
  }

  function moverFoto(de: number, para: number) {
    if (de === para || para < 0 || para >= pendingFotos.length) return;
    setPendingFotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(de, 1);
      next.splice(para, 0, moved);
      return next;
    });
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, index: number) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // dataTransfer.setData é exigido pelo Firefox para iniciar o drag.
    e.dataTransfer.setData("text/plain", String(index));
  }
  function handleDragOver(e: React.DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) setDragOverIndex(index);
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault();
    if (dragIndex === null) return;
    moverFoto(dragIndex, index);
    setDragIndex(null);
    setDragOverIndex(null);
  }
  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
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
          // O interceptor do `api` remove o Content-Type quando o body é
          // FormData — assim o browser adiciona o boundary correto.
          await api.post(`/imoveis/${imovelId}/fotos`, formData);
        } catch (err: unknown) {
          const msg = getErrorMessage(err, "tente adicioná-las na edição.");
          toast.warning(`Imóvel cadastrado, mas houve um erro ao enviar as fotos: ${msg}`);
          router.push(`/imoveis/${imovelId}`);
          return;
        }
      }

      toast.success("Imóvel cadastrado com sucesso!");
      router.push(`/imoveis/${imovelId}`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Erro ao cadastrar imóvel. Verifique os dados."));
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
          <span className="text-xs text-slate-400">{pendingFotos.length}/{MAX_FOTOS}</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          A primeira foto é a capa. Arraste para reordenar, gire usando o ícone <RotateCw className="inline w-3 h-3 align-text-bottom" /> se necessário.
          As fotos são enviadas automaticamente ao cadastrar o imóvel.
        </p>

        {/* Dropzone */}
        {pendingFotos.length < MAX_FOTOS && (
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
              <p className="text-xs">JPEG, PNG, WebP · Até {MAX_FOTOS - pendingFotos.length} foto{MAX_FOTOS - pendingFotos.length !== 1 ? "s" : ""}</p>
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
            {pendingFotos.map((file, index) => {
              const isDragging = dragIndex === index;
              const isOver = dragOverIndex === index && dragIndex !== index;
              return (
                <div
                  key={`${file.name}-${index}-${file.lastModified}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative group aspect-square rounded-lg border transition cursor-grab active:cursor-grabbing ${
                    isDragging ? "opacity-40 border-[#585a4f]" : "border-slate-100"
                  } ${isOver ? "ring-2 ring-[#585a4f] ring-offset-1" : ""}`}
                  title="Arraste para reordenar"
                >
                  <img
                    src={previews[index]}
                    alt={`Foto ${index + 1}`}
                    draggable={false}
                    className="w-full h-full object-cover rounded-lg pointer-events-none select-none"
                  />

                  {/* Badge de capa */}
                  {index === 0 && (
                    <div className="absolute top-1 left-1 bg-amber-400 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium shadow">
                      Capa
                    </div>
                  )}

                  {/* Indicador de drag */}
                  <div className="absolute bottom-1 left-1 p-0.5 bg-black/40 text-white rounded-md opacity-0 group-hover:opacity-100 transition">
                    <GripVertical className="w-3 h-3" />
                  </div>

                  {/* Botões de ação */}
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                    <button
                      type="button"
                      draggable={false}
                      disabled={rotacionandoIdx === index}
                      onClick={(e) => { e.stopPropagation(); rotacionarFoto(index); }}
                      className="p-1 bg-slate-700 hover:bg-slate-800 text-white rounded-md disabled:opacity-60"
                      title="Girar 90°"
                    >
                      <RotateCw className={`w-3 h-3 ${rotacionandoIdx === index ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      type="button"
                      draggable={false}
                      onClick={(e) => { e.stopPropagation(); removerFoto(index); }}
                      className="p-1 bg-red-500 hover:bg-red-600 text-white rounded-md"
                      title="Remover"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Botões mover (acessibilidade / fallback mobile) */}
                  <div className="absolute bottom-1 right-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      draggable={false}
                      disabled={index === 0}
                      onClick={(e) => { e.stopPropagation(); moverFoto(index, index - 1); }}
                      className="px-1.5 text-[10px] leading-none bg-white/90 hover:bg-white border border-slate-200 text-slate-700 rounded disabled:opacity-30"
                      title="Mover para frente"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      draggable={false}
                      disabled={index === pendingFotos.length - 1}
                      onClick={(e) => { e.stopPropagation(); moverFoto(index, index + 1); }}
                      className="px-1.5 text-[10px] leading-none bg-white/90 hover:bg-white border border-slate-200 text-slate-700 rounded disabled:opacity-30"
                      title="Mover para trás"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
