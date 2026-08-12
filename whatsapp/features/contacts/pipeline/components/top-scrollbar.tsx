"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * Barra de rolagem horizontal espelhada acima do quadro. Com muitas etapas, a
 * barra nativa no rodapé obriga a descer a tela até o fim da coluna mais longa
 * só para rolar de lado — e aí os títulos das etapas já saíram de vista.
 *
 * É um elemento separado (e não o truque de girar o container em 180°) porque
 * a transformação bagunça as coordenadas do drag-and-drop dos cartões.
 */
export function TopScrollbar({
  targetRef,
}: {
  targetRef: RefObject<HTMLDivElement | null>;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const syncing = useRef<"bar" | "target" | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    const bar = barRef.current;
    if (!target || !bar) return;

    function measure() {
      if (!target) return;
      setWidth(target.scrollWidth);
    }
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(target);
    for (const child of Array.from(target.children)) observer.observe(child);

    function onTargetScroll() {
      if (!target || !bar) return;
      if (syncing.current === "bar") {
        syncing.current = null;
        return;
      }
      syncing.current = "target";
      bar.scrollLeft = target.scrollLeft;
    }
    function onBarScroll() {
      if (!target || !bar) return;
      if (syncing.current === "target") {
        syncing.current = null;
        return;
      }
      syncing.current = "bar";
      target.scrollLeft = bar.scrollLeft;
    }

    target.addEventListener("scroll", onTargetScroll, { passive: true });
    bar.addEventListener("scroll", onBarScroll, { passive: true });
    return () => {
      observer.disconnect();
      target.removeEventListener("scroll", onTargetScroll);
      bar.removeEventListener("scroll", onBarScroll);
    };
  }, [targetRef]);

  return (
    <div
      ref={barRef}
      aria-hidden
      className="hidden overflow-x-auto overscroll-x-contain md:block"
    >
      <div style={{ width }} className="h-px" />
    </div>
  );
}
