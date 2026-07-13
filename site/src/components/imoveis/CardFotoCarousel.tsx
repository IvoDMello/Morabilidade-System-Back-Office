"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Mini-carrossel de fotos para os cards de imóvel (listagem e destaques).
 * Vive DENTRO de um <Link> — swipe no touch usa scroll nativo (não navega)
 * e as setas fazem preventDefault para não abrir a página do imóvel.
 */
export function CardFotoCarousel({
  fotos,
  alt,
  sizes,
  imgClassName = "",
  totalFotos,
}: {
  fotos: string[];
  alt: string;
  sizes: string;
  imgClassName?: string;
  /** Total de fotos do imóvel; se maior que as exibidas, mostra aviso "ver todas". */
  totalFotos?: number;
}) {
  const trilhoRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const varias = fotos.length > 1;
  const temMaisFotos = (totalFotos ?? fotos.length) > fotos.length;

  function irPara(e: React.MouseEvent, dir: -1 | 1) {
    e.preventDefault();
    e.stopPropagation();
    const el = trilhoRef.current;
    if (!el) return;
    const alvo = Math.min(Math.max(idx + dir, 0), fotos.length - 1);
    el.scrollTo({ left: alvo * el.clientWidth, behavior: "smooth" });
  }

  function onScroll() {
    const el = trilhoRef.current;
    if (!el) return;
    setIdx(Math.min(Math.round(el.scrollLeft / el.clientWidth), fotos.length - 1));
  }

  return (
    <div className="absolute inset-0">
      <div
        ref={trilhoRef}
        onScroll={varias ? onScroll : undefined}
        className="flex h-full w-full overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {fotos.map((url, i) => (
          <div key={`${url}-${i}`} className="relative h-full w-full flex-shrink-0 snap-center snap-always">
            <Image
              src={url}
              alt={i === 0 ? alt : `${alt} — foto ${i + 1}`}
              fill
              className={`object-cover object-center ${imgClassName}`}
              sizes={sizes}
            />
          </div>
        ))}
      </div>

      {varias && (
        <>
          {/* Setas — só fazem sentido com mouse; aparecem no hover do card */}
          {idx > 0 && (
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={(e) => irPara(e, -1)}
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {idx < fotos.length - 1 && (
            <button
              type="button"
              aria-label="Próxima foto"
              onClick={(e) => irPara(e, 1)}
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Aviso "ver todas" — aparece na última foto exibida quando há mais no imóvel */}
          {temMaisFotos && idx === fotos.length - 1 && (
            <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-black/45 text-white/90 text-[11px] font-medium backdrop-blur-sm">
                Abra para ver todas as fotos e detalhes
              </span>
            </div>
          )}

          {/* Indicadores */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 pointer-events-none">
            {fotos.map((_, i) => (
              <span
                key={i}
                className={`rounded-full transition-all duration-200 ${
                  i === idx ? "w-2 h-2 bg-white" : "w-1.5 h-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
