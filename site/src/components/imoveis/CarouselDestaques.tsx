"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ImovelCard } from "@/components/imoveis/ImovelCard";
import type { ImovelCard as ImovelCardType } from "@/types";

interface Props {
  imoveis: ImovelCardType[];
}

export function CarouselDestaques({ imoveis }: Props) {
  // align "start" + breakpoints diferentes via slidesToScroll: avança 1 por vez,
  // mostra 1 no mobile, 2 em sm, 3 em lg.
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: false,
    slidesToScroll: 1,
    containScroll: "trimSnaps",
  });

  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    setSnapCount(emblaApi.scrollSnapList().length);
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  if (imoveis.length === 0) return null;

  return (
    <div className="relative">
      {/* Viewport do carrossel */}
      <div className="overflow-hidden -mx-4 sm:-mx-0" ref={emblaRef}>
        <div className="flex gap-5 px-4 sm:px-0">
          {imoveis.map((imovel) => (
            <div
              key={imovel.id}
              className="flex-[0_0_85%] sm:flex-[0_0_calc(50%-10px)] lg:flex-[0_0_calc(33.333%-14px)] min-w-0"
            >
              <ImovelCard imovel={imovel} />
            </div>
          ))}
        </div>
      </div>

      {/* Setas — só desktop */}
      <button
        type="button"
        onClick={scrollPrev}
        disabled={!canPrev}
        aria-label="Anterior"
        className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 w-11 h-11 items-center justify-center rounded-full bg-white shadow-lg border border-slate-100 text-slate-600 hover:text-[#585a4f] hover:scale-105 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 z-10"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={scrollNext}
        disabled={!canNext}
        aria-label="Próximo"
        className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 w-11 h-11 items-center justify-center rounded-full bg-white shadow-lg border border-slate-100 text-slate-600 hover:text-[#585a4f] hover:scale-105 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 z-10"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots — todas as telas (útil principalmente no mobile) */}
      {snapCount > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {Array.from({ length: snapCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Ir para slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === selectedIndex ? "w-6" : "w-1.5 hover:w-3"
              }`}
              style={{
                backgroundColor: i === selectedIndex ? "#585a4f" : "#cbd5e1",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
