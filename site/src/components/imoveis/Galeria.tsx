"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff, Loader2, X, ZoomIn } from "lucide-react";
import type { Foto } from "@/types";

export function Galeria({ fotos }: { fotos: Foto[] }) {
  const [ativa, setAtiva] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [imgCarregando, setImgCarregando] = useState(true);

  // Índices das fotos vizinhas (com wrap-around) para pré-carregar e cobrir a
  // navegação instantânea. Em galeria com 1 foto, prox/ant apontam para si mesma.
  const proxIdx = useMemo(
    () => (fotos.length > 0 ? (ativa + 1) % fotos.length : 0),
    [ativa, fotos.length]
  );
  const antIdx = useMemo(
    () => (fotos.length > 0 ? (ativa === 0 ? fotos.length - 1 : ativa - 1) : 0),
    [ativa, fotos.length]
  );

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const lockedAxis = useRef<"x" | "y" | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbsStripRef = useRef<HTMLDivElement | null>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const strip = thumbsStripRef.current;
    const thumb = thumbRefs.current[ativa];
    if (!strip || !thumb) return;
    const stripRect = strip.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    const offset =
      thumbRect.left + thumbRect.width / 2 - (stripRect.left + stripRect.width / 2);
    if (Math.abs(offset) < 1) return;
    strip.scrollBy({ left: offset, behavior: "smooth" });
  }, [ativa]);

  const anterior = useCallback(() => {
    setAtiva((i) => (i === 0 ? fotos.length - 1 : i - 1));
    setImgCarregando(true);
  }, [fotos.length]);

  const proxima = useCallback(() => {
    setAtiva((i) => (i === fotos.length - 1 ? 0 : i + 1));
    setImgCarregando(true);
  }, [fotos.length]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    lockedAxis.current = null;
    setDrag(0);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (lockedAxis.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        lockedAxis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
    }
    if (lockedAxis.current === "x") {
      if (!dragging) setDragging(true);
      setDrag(dx);
    }
  }

  function onTouchEnd() {
    const width = trackRef.current?.clientWidth ?? 1;
    const threshold = Math.min(80, width * 0.18);
    if (drag > threshold) anterior();
    else if (drag < -threshold) proxima();
    touchStartX.current = null;
    touchStartY.current = null;
    lockedAxis.current = null;
    setDragging(false);
    setDrag(0);
  }

  // Esc fecha lightbox; setas navegam
  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowLeft") anterior();
      else if (e.key === "ArrowRight") proxima();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, anterior, proxima]);

  // Abrir o lightbox: força o estado de carregando para que o spinner apareça
  // até o onLoad do Image disparar (evita flash de tela preta).
  function abrirLightbox() {
    setImgCarregando(true);
    setLightbox(true);
  }

  if (fotos.length === 0) {
    return (
      <div className="aspect-[3/4] max-h-[600px] mx-auto rounded-xl bg-slate-100 flex flex-col items-center justify-center gap-2 text-slate-300">
        <ImageOff className="w-10 h-10" />
        <p className="text-sm">Sem fotos cadastradas</p>
      </div>
    );
  }

  const slidePct = -ativa * 100;
  const dragPx = drag;

  return (
    <div className="space-y-3">
      {/* Foto principal — carrossel com transição */}
      <div
        className="relative w-full max-w-md mx-auto aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 group select-none"
        style={{ maxHeight: "min(75vh, 700px)", touchAction: "pan-y" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          ref={trackRef}
          className="absolute inset-0 flex"
          style={{
            transform: `translate3d(calc(${slidePct}% + ${dragPx}px), 0, 0)`,
            transition: dragging ? "none" : "transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)",
            willChange: dragging ? "transform" : undefined,
          }}
        >
          {fotos.map((foto, i) => {
            // Carrega antecipadamente a foto ativa e suas vizinhas — evita o
            // delay de fetch quando o usuário clica em "próxima".
            const eager = i === ativa || i === proxIdx || i === antIdx;
            return (
              <div key={foto.id} className="relative w-full h-full flex-shrink-0">
                <Image
                  src={foto.url}
                  alt={`Foto ${i + 1}`}
                  fill
                  className="object-cover object-center pointer-events-none"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority={i === 0}
                  loading={i === 0 ? undefined : eager ? "eager" : "lazy"}
                  draggable={false}
                />
              </div>
            );
          })}
        </div>

        {/* Botão de zoom — abre lightbox */}
        <button
          onClick={abrirLightbox}
          className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/20 hover:bg-black/75 hover:scale-105 transition focus:outline-none focus:ring-2 focus:ring-[#d8cb6a]"
          aria-label="Ampliar imagem"
          title="Ampliar"
        >
          <ZoomIn className="w-5 h-5" strokeWidth={2.25} />
        </button>

        {fotos.length > 1 && (
          <>
            <button
              onClick={anterior}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition opacity-100 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={proxima}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition opacity-100 md:opacity-0 md:group-hover:opacity-100"
              aria-label="Próxima foto"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded-full bg-black/50 text-white text-xs">
              {ativa + 1} / {fotos.length}
            </div>
          </>
        )}
      </div>

      {/* Miniaturas */}
      {fotos.length > 1 && (
        <div
          ref={thumbsStripRef}
          className="flex gap-2 overflow-x-auto hide-scrollbar pb-1"
          style={{ justifyContent: "safe center", scrollBehavior: "smooth" }}
        >
          {fotos.map((foto, i) => (
            <button
              key={foto.id}
              ref={(el) => {
                thumbRefs.current[i] = el;
              }}
              onClick={() => setAtiva(i)}
              className={`relative flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden border-2 transition ${
                i === ativa ? "opacity-100" : "border-transparent opacity-60 hover:opacity-90"
              }`}
              style={i === ativa ? { borderColor: "#d8cb6a" } : undefined}
              aria-label={`Ver foto ${i + 1}`}
            >
              <Image
                src={foto.url}
                alt={`Miniatura ${i + 1}`}
                fill
                className="object-cover object-center"
                sizes="48px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox — pinch-zoom nativo do browser */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 animate-fade-in"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(false);
            }}
            className="absolute top-4 right-4 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-white text-slate-900 shadow-lg ring-2 ring-white/80 hover:bg-slate-100 hover:scale-105 transition focus:outline-none focus:ring-4 focus:ring-[#d8cb6a]"
            aria-label="Fechar"
            title="Fechar (Esc)"
          >
            <X className="w-7 h-7" strokeWidth={2.5} />
          </button>

          {/* Spinner enquanto a imagem carrega — sobreposto, mas escondido sem layout shift */}
          {imgCarregando && (
            <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
              <Loader2 className="w-10 h-10 text-white/70 animate-spin" />
            </div>
          )}

          {/* Imagem ativa — next/image otimizado. O backdrop pai mantém o click-to-close;
              o wrapper interno tem `pointer-events-none` exceto na própria imagem para
              que clicar fora da foto feche o lightbox. */}
          <div
            className="absolute inset-0 z-10 flex items-center justify-center p-4 sm:p-8 pointer-events-none"
            style={{ touchAction: "pinch-zoom" }}
          >
            <div
              className="relative w-full h-full max-w-7xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                key={fotos[ativa].id}
                src={fotos[ativa].url}
                alt={`Foto ${ativa + 1}`}
                fill
                priority
                sizes="100vw"
                quality={90}
                className={`object-contain select-none transition-opacity duration-200 ${
                  imgCarregando ? "opacity-0" : "opacity-100"
                }`}
                draggable={false}
                onLoad={() => setImgCarregando(false)}
              />
            </div>
          </div>

          {/* Preload das vizinhas (off-screen / invisível) — quando o usuário
              navegar, as imagens já estarão no cache do browser. */}
          {fotos.length > 1 && (
            <div aria-hidden className="hidden">
              <Image src={fotos[proxIdx].url} alt="" width={1} height={1} sizes="100vw" priority />
              {antIdx !== proxIdx && (
                <Image src={fotos[antIdx].url} alt="" width={1} height={1} sizes="100vw" priority />
              )}
            </div>
          )}

          {fotos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  anterior();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 backdrop-blur-sm transition focus:outline-none focus:ring-2 focus:ring-[#d8cb6a]"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="w-7 h-7" strokeWidth={2.25} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  proxima();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 backdrop-blur-sm transition focus:outline-none focus:ring-2 focus:ring-[#d8cb6a]"
                aria-label="Próxima foto"
              >
                <ChevronRight className="w-7 h-7" strokeWidth={2.25} />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-sm font-medium tabular-nums">
                {ativa + 1} / {fotos.length}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
