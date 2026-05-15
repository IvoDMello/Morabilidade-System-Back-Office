"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ImovelCard } from "@/types";
import { DestCard } from "./DestCard";

function ScrollArrow({
  dir,
  visible,
  onClick,
}: {
  dir: "left" | "right";
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === "left" ? "Anterior" : "Próximo"}
      className="absolute top-1/2 z-10 flex items-center justify-center transition-all duration-200 focus:outline-none"
      style={{
        transform: `translateY(-50%) translateX(${dir === "left" ? "-50%" : "50%"})`,
        [dir === "left" ? "left" : "right"]: 0,
        width: 44,
        height: 44,
        borderRadius: "50%",
        backgroundColor: "#fcfcfc",
        border: "1.5px solid #e4e1d6",
        boxShadow: "0 4px 18px rgba(88,90,79,0.15)",
        color: "#585a4f",
        cursor: "pointer",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget;
        btn.style.backgroundColor = "#585a4f";
        btn.style.color = "#fcfcfc";
        btn.style.borderColor = "#585a4f";
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget;
        btn.style.backgroundColor = "#fcfcfc";
        btn.style.color = "#585a4f";
        btn.style.borderColor = "#e4e1d6";
      }}
    >
      {dir === "left" ? (
        <ChevronLeft style={{ width: 20, height: 20 }} />
      ) : (
        <ChevronRight style={{ width: 20, height: 20 }} />
      )}
    </button>
  );
}

function DestaquesScrollInner({ imoveis }: { imoveis: ImovelCard[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const firstCard = el.firstElementChild as HTMLElement | null;
    const cardWidth = firstCard?.getBoundingClientRect().width ?? el.clientWidth * 0.72;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 20;
    const step = cardWidth + gap;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  return (
    <div className="relative" style={{ paddingLeft: 28, paddingRight: 28 }}>
      <ScrollArrow dir="left" visible={canLeft} onClick={() => scroll("left")} />

      <div
        ref={scrollRef}
        className="flex gap-5 hide-scrollbar"
        style={{
          overflowX: "auto",
          paddingBottom: 4,
          scrollSnapType: "x mandatory",
          scrollSnapStop: "always",
        }}
      >
        {imoveis.map((im) => (
          <DestCard key={im.id} imovel={im} />
        ))}
      </div>

      <ScrollArrow dir="right" visible={canRight} onClick={() => scroll("right")} />
    </div>
  );
}

export function DestaquesScroll({ imoveis }: { imoveis: ImovelCard[] }) {
  if (imoveis.length === 0) return null;
  return <DestaquesScrollInner imoveis={imoveis} />;
}
