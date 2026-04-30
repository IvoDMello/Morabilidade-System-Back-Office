"use client";

import { useState } from "react";

interface Testimonial {
  nome: string;
  texto: string;
}

export function TestimonialCarousel({ depoimentos }: { depoimentos: Testimonial[] }) {
  const [idx, setIdx] = useState(0);
  const dep = depoimentos[idx];

  return (
    <div className="max-w-[800px] mx-auto text-center">
      {/* Stars */}
      <div className="flex justify-center gap-1 mb-7">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{ color: "#d8cb6a", fontSize: 18 }}>★</span>
        ))}
      </div>

      {/* Quote */}
      <blockquote
        className="font-serif italic leading-relaxed mb-6"
        style={{
          fontSize: "clamp(16px, 2vw, 20px)",
          color: "#2d2f28",
          lineHeight: 1.7,
        }}
      >
        &ldquo;{dep.texto}&rdquo;
      </blockquote>

      {/* Name */}
      <p className="text-sm font-semibold mb-7" style={{ color: "#585a4f" }}>
        {dep.nome}
      </p>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2">
        {depoimentos.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Depoimento ${i + 1}`}
            style={{
              width: i === idx ? 24 : 8,
              height: 8,
              borderRadius: 100,
              backgroundColor: i === idx ? "#d8cb6a" : "#e4e1d6",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "all 0.2s",
            }}
          />
        ))}
      </div>
    </div>
  );
}
