"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff, X, ZoomIn } from "lucide-react";
import type { Foto } from "@/types";

export function Galeria({ fotos }: { fotos: Foto[] }) {
  const [ativa, setAtiva] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState(false);

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

  function anterior() {
    setAtiva((i) => (i === 0 ? fotos.length - 1 : i - 1));
  }

  function proxima() {
    setAtiva((i) => (i === fotos.length - 1 ? 0 : i + 1));
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, fotos.length]);

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
            willChange: "transform",
          }}
        >
          {fotos.map((foto, i) => (
            <div key={foto.id} className="relative w-full h-full flex-shrink-0">
              <Image
                src={foto.url}
                alt={`Foto ${i + 1}`}
                fill
                className="object-cover object-center pointer-events-none"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority={i === 0}
                draggable={false}
              />
            </div>
          ))}
        </div>

        {/* Botão de zoom — abre lightbox */}
        <button
          onClick={() => setLightbox(true)}
          className="absolute top-2 right-2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition opacity-100 md:opacity-0 md:group-hover:opacity-100"
          aria-label="Ampliar imagem"
        >
          <ZoomIn className="w-4 h-4" />
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
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(false);
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            aria-label="Fechar"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="relative w-full h-full flex items-center justify-center"
            style={{ touchAction: "pinch-zoom" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotos[ativa].url}
              alt={`Foto ${ativa + 1}`}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          </div>

          {fotos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  anterior();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  proxima();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                aria-label="Próxima foto"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-sm">
                {ativa + 1} / {fotos.length}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
