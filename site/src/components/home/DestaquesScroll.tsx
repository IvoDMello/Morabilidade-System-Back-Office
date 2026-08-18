"use client";

import { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
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
      className="absolute top-1/2 z-10 hidden md:flex items-center justify-center transition-all duration-200 focus:outline-none"
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

const AUTOPLAY_SLIDE_SPEED_PX_PER_SEC = 55;
const AUTOPLAY_PAUSE_MS = 2000;
const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

// child.offsetLeft é relativo ao offsetParent mais próximo (o wrapper
// posicionado lá fora, que tem padding próprio) e não ao container de
// scroll em si — por isso subtraímos el.offsetLeft, senão todo card fica
// centralizado alguns pixels fora do lugar (some com o peek de um dos lados).
function leftWithin(el: HTMLDivElement, child: HTMLElement): number {
  return child.offsetLeft - el.offsetLeft;
}

// Posição de scroll que deixa o card centralizado no container (mesmo
// alinhamento do scroll-snap-align:center dos cards).
function centeredTarget(el: HTMLDivElement, child: HTMLElement): number {
  const target = leftWithin(el, child) - (el.clientWidth - child.offsetWidth) / 2;
  return Math.max(0, Math.min(target, el.scrollWidth - el.clientWidth));
}

// Índice do card visualmente mais centralizado. Compara pelo centro "cru"
// (sem o clamping de centeredTarget) porque perto das pontas do trilho
// vários cards podem ter o alvo clampado pro mesmo valor, o que faria
// esta função sempre devolver o primeiro deles em vez do card real do fim.
function nearestIndexFor(el: HTMLDivElement): number {
  const viewportCenter = el.scrollLeft + el.clientWidth / 2;
  const children = Array.from(el.children) as HTMLElement[];
  let closest = 0;
  let closestDist = Infinity;
  children.forEach((child, i) => {
    const childCenter = leftWithin(el, child) + child.offsetWidth / 2;
    const dist = Math.abs(childCenter - viewportCenter);
    if (dist < closestDist) {
      closestDist = dist;
      closest = i;
    }
  });
  return closest;
}

function DestaquesScrollInner({ imoveis }: { imoveis: ImovelCard[] }) {
  // Triplica a lista (3 cópias seguidas) e começa exibindo a cópia do meio.
  // Assim TODO card sempre tem vizinhos de verdade dos dois lados (nunca uma
  // ponta "sem nada"), e quando o autoplay avança da cópia do meio pra
  // terceira, resetamos de volta pra posição equivalente na cópia do meio —
  // como as cópias são idênticas, esse reset nunca se percebe, e nunca
  // chegamos perto da borda real do array. É um loop infinito de verdade.
  const hasClones = imoveis.length > 1;
  const N = imoveis.length;
  const items = hasClones ? [...imoveis, ...imoveis, ...imoveis] : imoveis;
  const startIndex = hasClones ? N : 0;
  const minRealIndex = hasClones ? N : 0;
  const maxRealIndex = hasClones ? 2 * N - 1 : N - 1;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const interactedRef = useRef(false);

  // O realce do card central é aplicado direto no DOM (não via estado do
  // React) porque ele precisa mudar no MESMO frame em que o scroll salta no
  // reset do loop. Via estado, o React só re-renderiza no frame seguinte, e
  // esse descompasso de 1 frame aparece como uma piscada.
  const applyFocus = useCallback((animate: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    const isMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
    const active = nearestIndexFor(el);
    Array.from(el.children).forEach((child, i) => {
      const node = child as HTMLElement;
      if (!isMobile) {
        // No desktop o card fica neutro: sem transform, opacity NEM transition
        // inline. Qualquer um dos três venceria as classes do card e mataria o
        // hover, que anima transform e box-shadow.
        node.style.transition = "";
        node.style.transform = "";
        node.style.opacity = "";
      } else {
        node.style.transition = animate
          ? "transform 500ms ease-out, opacity 500ms ease-out"
          : "none";
        node.style.transform = i === active ? "scale(1)" : "scale(0.92)";
        node.style.opacity = i === active ? "1" : "0.55";
      }
    });
  }, []);

  // Posiciona o scroll no primeiro card da cópia do meio antes do navegador
  // pintar a tela, pra não piscar a primeira cópia.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !hasClones) return;
    const child = el.children[startIndex] as HTMLElement | undefined;
    if (!child) return;
    el.scrollLeft = centeredTarget(el, child);
    applyFocus(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imoveis.length]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    applyFocus(true);
  }, [applyFocus]);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  const scrollToIndex = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(minRealIndex, Math.min(index, maxRealIndex));
    const child = el.children[clamped] as HTMLElement | undefined;
    if (!child) return;
    el.scrollTo({ left: centeredTarget(el, child), behavior: "smooth" });
  };

  // Auto-rotação só no mobile: fica ~2s parado em cada imóvel e depois
  // desliza devagar e continuamente até o próximo (sem pular). Para
  // permanentemente assim que o usuário interagir (arrasto horizontal).
  useEffect(() => {
    if (imoveis.length <= 1) return;
    const el = scrollRef.current;
    if (!el) return;
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    let rafId: number | null = null;
    let lastTime: number | null = null;
    let posFloat = el.scrollLeft;
    let pauseRemaining = AUTOPLAY_PAUSE_MS / 1000;
    let targetIndex: number | null = null;
    let target: number | null = null;
    // Só começa a deslizar quando a seção entrar na tela (ver IntersectionObserver
    // abaixo) — não junto com o carregamento da página.
    let hasBecomeVisible = false;

    const stop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastTime = null;
    };

    const frame = (time: number) => {
      if (interactedRef.current) {
        stop();
        return;
      }
      if (lastTime === null) lastTime = time;
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (pauseRemaining > 0) {
        pauseRemaining -= dt;
        rafId = window.requestAnimationFrame(frame);
        return;
      }

      if (target === null) {
        const el2 = scrollRef.current;
        if (el2) {
          let currentIndex = nearestIndexFor(el2);

          // Acabamos de pausar já dentro da 3ª cópia da lista. Como a 2ª e a
          // 3ª cópia têm exatamente o mesmo conteúdo, resetar agora pra
          // posição equivalente na 2ª cópia é imperceptível — e assim nunca
          // chegamos perto da borda real do array, o loop nunca "acaba".
          if (hasClones && currentIndex > maxRealIndex) {
            const equivalentIndex = currentIndex - N;
            const equivalentChild = el2.children[equivalentIndex] as HTMLElement | undefined;
            if (equivalentChild) {
              const resetLeft = centeredTarget(el2, equivalentChild);
              el2.scrollLeft = resetLeft;
              posFloat = resetLeft;
              // Realce reaplicado sem transição no MESMO frame do salto:
              // é isso que impede a piscada de 1 frame no reset do loop.
              applyFocus(false);
            }
            currentIndex = equivalentIndex;
          }

          targetIndex = currentIndex + 1;
          const child = el2.children[targetIndex] as HTMLElement | undefined;
          if (child) {
            target = centeredTarget(el2, child);
            posFloat = el2.scrollLeft;
          }
        }
        rafId = window.requestAnimationFrame(frame);
        return;
      }

      const remaining = target - posFloat;
      const step = AUTOPLAY_SLIDE_SPEED_PX_PER_SEC * dt;
      if (Math.abs(remaining) <= step) {
        posFloat = target;
        el.scrollLeft = posFloat;
        target = null;
        pauseRemaining = AUTOPLAY_PAUSE_MS / 1000;
      } else {
        posFloat += Math.sign(remaining) * step;
        el.scrollLeft = posFloat;
      }

      rafId = window.requestAnimationFrame(frame);
    };

    const start = () => {
      if (rafId !== null) return;
      if (interactedRef.current) return;
      if (!mql.matches) return;
      if (!hasBecomeVisible) return;
      lastTime = null;
      posFloat = el.scrollLeft;
      pauseRemaining = AUTOPLAY_PAUSE_MS / 1000;
      target = null;
      rafId = window.requestAnimationFrame(frame);
    };

    const onMediaChange = () => {
      applyFocus(false);
      if (mql.matches) start();
      else stop();
    };

    // Só cancela o autoplay se o toque for de fato um arrasto horizontal
    // (swipe entre imóveis). Um toque para rolar a página verticalmente
    // (ex: chegando até a seção) não deve derrubar a animação.
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDecided = false;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchDecided = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchDecided) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - touchStartX);
      const dy = Math.abs(t.clientY - touchStartY);
      if (dx < 6 && dy < 6) return;
      touchDecided = true;
      if (dx > dy) {
        interactedRef.current = true;
        stop();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });

    // Só libera o autoplay quando a seção realmente entra na tela — não
    // junto com o carregamento da página, mesmo que ela comece fora da
    // viewport (lá embaixo, antes do usuário rolar até ela).
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          hasBecomeVisible = true;
          start();
          io.disconnect();
        }
      },
      { threshold: 0.85 }
    );
    io.observe(el);

    mql.addEventListener("change", onMediaChange);

    return () => {
      stop();
      io.disconnect();
      mql.removeEventListener("change", onMediaChange);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [imoveis.length, applyFocus]);

  const handleArrowClick = (dir: "left" | "right") => {
    interactedRef.current = true;
    const el = scrollRef.current;
    if (!el) return;
    const current = nearestIndexFor(el);
    scrollToIndex(current + (dir === "left" ? -1 : 1));
  };

  return (
    <div className="relative mx-[calc(50%-50vw)] w-screen md:mx-0 md:w-auto md:px-7">
      <ScrollArrow dir="left" visible={canLeft} onClick={() => handleArrowClick("left")} />

      <div
        ref={scrollRef}
        className="flex gap-4 md:gap-5 hide-scrollbar [scroll-snap-type:none] md:[scroll-snap-type:x_mandatory] md:[scroll-snap-stop:always]"
        style={{
          overflowX: "auto",
          // overflow-x:auto obriga o eixo Y a virar auto também, então sem
          // folga vertical o trilho recorta o "levantar" e a sombra do hover.
          paddingTop: 16,
          paddingBottom: 34,
        }}
      >
        {items.map((im, i) => {
          const key = hasClones ? `${im.id}-copy${Math.floor(i / N)}` : im.id;
          return <DestCard key={key} imovel={im} />;
        })}
      </div>

      <ScrollArrow dir="right" visible={canRight} onClick={() => handleArrowClick("right")} />
    </div>
  );
}

export function DestaquesScroll({ imoveis }: { imoveis: ImovelCard[] }) {
  if (imoveis.length === 0) return null;
  return <DestaquesScrollInner imoveis={imoveis} />;
}
