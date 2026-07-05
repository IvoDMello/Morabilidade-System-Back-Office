"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImagePlus, Trash2, Video, Star, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { uploadFoto, uploadVideo, signedUrl, VIDEO_MAX_MB } from "@/lib/storage";
import { videoSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { FotosLightbox } from "./FotosLightbox";
import type { Midia } from "@/types";

function SortableFoto({
  m,
  ehCapa,
  thumb,
  onCapa,
  onRemover,
  onAbrir,
}: {
  m: Midia;
  ehCapa: boolean;
  thumb?: string;
  onCapa: () => void;
  onRemover: () => void;
  onAbrir: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: m.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-md bg-muted",
        ehCapa && "ring-2 ring-primary ring-offset-2",
        isDragging && "z-10 opacity-60"
      )}
    >
      {thumb && (
        <button
          type="button"
          onClick={onAbrir}
          className="absolute inset-0 cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Ver foto em tamanho grande"
        >
          <Image src={thumb} alt="" fill sizes="120px" className="object-cover" />
        </button>
      )}

      {ehCapa && (
        <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
          <Star className="h-3 w-3 fill-current" /> Capa
        </span>
      )}

      <button
        className="absolute bottom-1 left-1 cursor-grab touch-none rounded bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
        {!ehCapa && (
          <button onClick={onCapa} className="rounded bg-black/60 p-1 text-white" aria-label="Definir como capa" title="Definir como capa">
            <Star className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={onRemover} className="rounded bg-black/60 p-1 text-white" aria-label="Remover">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function Galeria({
  captacaoId,
  midiasIniciais,
  capaInicial,
}: {
  captacaoId: string;
  midiasIniciais: Midia[];
  capaInicial: string | null;
}) {
  const [midias, setMidias] = useState<Midia[]>(midiasIniciais);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  // URLs assinadas dos vídeos enviados ao Storage (1h: cobre a reprodução).
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviandoVideo, setEnviandoVideo] = useState(false);
  const [url, setUrl] = useState("");
  const [capa, setCapa] = useState<string | null>(capaInicial);
  // Visualizador: índice da foto aberta (entre as fotos).
  const [viewer, setViewer] = useState<number | null>(null);

  async function definirCapa(thumbPath: string | null) {
    setCapa(thumbPath);
    const supabase = createClient();
    await supabase.from("captacao").update({ capa_path: thumbPath }).eq("id", captacaoId);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const entries = await Promise.all(
        midias
          .filter((m) => m.tipo === "foto" && m.thumb_path)
          .map(async (m) => [m.id, await signedUrl(m.thumb_path!)] as const)
      );
      if (active) setThumbs(Object.fromEntries(entries));
      const videos = await Promise.all(
        midias
          .filter((m) => m.tipo === "video" && m.storage_path)
          .map(async (m) => [m.id, await signedUrl(m.storage_path!, 3600)] as const)
      );
      if (active) setVideoUrls(Object.fromEntries(videos));
    })();
    return () => {
      active = false;
    };
  }, [midias]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setEnviando(true);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        const paths = await uploadFoto(captacaoId, file);
        const { data, error } = await supabase
          .from("midia")
          .insert({ captacao_id: captacaoId, tipo: "foto", ...paths })
          .select()
          .single();
        if (error) throw error;
        const nova = data as Midia;
        setMidias((m) => [...m, nova]);
        if (!capa && nova.thumb_path) await definirCapa(nova.thumb_path); // 1ª foto vira capa
      }
      toast.success("Fotos enviadas.");
    } catch {
      toast.error("Falha ao enviar foto.");
    } finally {
      setEnviando(false);
    }
  }

  async function onVideoFiles(files: FileList | null) {
    if (!files?.length) return;
    setEnviandoVideo(true);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        const paths = await uploadVideo(captacaoId, file);
        const { data, error } = await supabase
          .from("midia")
          .insert({ captacao_id: captacaoId, tipo: "video", ...paths })
          .select()
          .single();
        if (error) throw error;
        setMidias((m) => [...m, data as Midia]);
      }
      toast.success("Vídeo enviado.");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Falha ao enviar vídeo.");
    } finally {
      setEnviandoVideo(false);
    }
  }

  async function addVideo() {
    const parsed = videoSchema.safeParse({ url_externa: url });
    if (!parsed.success) {
      toast.error("URL de vídeo inválida.");
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("midia")
      .insert({ captacao_id: captacaoId, tipo: "video", url_externa: url })
      .select()
      .single();
    if (error) {
      toast.error("Erro ao adicionar vídeo.");
      return;
    }
    setMidias((m) => [...m, data as Midia]);
    setUrl("");
  }

  async function remover(m: Midia) {
    const supabase = createClient();
    await supabase.from("midia").delete().eq("id", m.id);
    if (m.storage_path) await supabase.storage.from("captacoes").remove([m.storage_path, m.thumb_path!].filter(Boolean));
    const restantes = midias.filter((x) => x.id !== m.id);
    setMidias(restantes);
    if (m.thumb_path && m.thumb_path === capa) {
      // capa removida: promove a próxima foto (ou limpa)
      const proxima = restantes.find((x) => x.tipo === "foto" && x.thumb_path);
      await definirCapa(proxima?.thumb_path ?? null);
    }
  }

  const fotos = midias.filter((m) => m.tipo === "foto");
  const videos = midias.filter((m) => m.tipo === "video");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } })
  );

  async function onReorder(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = fotos.findIndex((f) => f.id === active.id);
    const newIndex = fotos.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const novasFotos = arrayMove(fotos, oldIndex, newIndex).map((f, i) => ({ ...f, ordem: i }));
    setMidias([...novasFotos, ...videos]);

    const supabase = createClient();
    await Promise.all(
      novasFotos.map((f) => supabase.from("midia").update({ ordem: f.ordem }).eq("id", f.id))
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button type="button" variant="outline" asChild disabled={enviando}>
            <span>
              <ImagePlus className="h-4 w-4" /> {enviando ? "Enviando..." : "Adicionar fotos"}
            </span>
          </Button>
        </label>
        <label className="inline-flex">
          <input
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onVideoFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            asChild
            disabled={enviandoVideo}
            title={`Vídeo gravado na visita (até ${VIDEO_MAX_MB} MB)`}
          >
            <span>
              <Video className="h-4 w-4" /> {enviandoVideo ? "Enviando vídeo..." : "Adicionar vídeo"}
            </span>
          </Button>
        </label>
      </div>

      {fotos.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorder}>
          <SortableContext items={fotos.map((f) => f.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((m, i) => (
                <SortableFoto
                  key={m.id}
                  m={m}
                  ehCapa={m.thumb_path != null && m.thumb_path === capa}
                  thumb={thumbs[m.id]}
                  onCapa={() => definirCapa(m.thumb_path)}
                  onRemover={() => remover(m)}
                  onAbrir={() => setViewer(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex gap-2">
        <Input placeholder="Link de vídeo (YouTube/Drive)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button type="button" variant="outline" onClick={addVideo}>
          <Video className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      {videos.map((m) =>
        m.storage_path ? (
          // Vídeo enviado ao Storage: player embutido.
          <div key={m.id} className="overflow-hidden rounded-md border">
            {videoUrls[m.id] ? (
              <video src={videoUrls[m.id]} controls preload="metadata" playsInline className="max-h-80 w-full bg-black" />
            ) : (
              <div className="flex h-40 items-center justify-center bg-muted text-sm text-muted-foreground">
                Carregando vídeo...
              </div>
            )}
            <div className="flex items-center justify-between p-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Video className="h-4 w-4" /> Vídeo da visita
              </span>
              <button onClick={() => remover(m)} aria-label="Remover vídeo">
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          </div>
        ) : (
          // Vídeo por link externo (YouTube/Drive).
          <div key={m.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
            <a href={m.url_externa!} target="_blank" rel="noreferrer" className="truncate text-primary underline">
              {m.url_externa}
            </a>
            <button onClick={() => remover(m)} aria-label="Remover">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )
      )}

      <FotosLightbox fotos={fotos} index={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
