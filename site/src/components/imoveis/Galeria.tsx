"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import type { Foto } from "@/types";

export function Galeria({ fotos }: { fotos: Foto[] }) {
  const [ativa, setAtiva] = useState(0);

  if (fotos.length === 0) {
    return (
      <div className="aspect-video rounded-xl bg-slate-100 flex flex-col items-center justify-center gap-2 text-slate-300">
        <ImageOff className="w-10 h-10" />
        <p className="text-sm">Sem fotos cadastradas</p>
      </div>
    );
  }

  function anterior() {
    setAtiva((i) => (i === 0 ? fotos.length - 1 : i - 1));
  }

  function proxima() {
    setAtiva((i) => (i === fotos.length - 1 ? 0 : i + 1));
  }

  return (
    <div className="space-y-3">
      {/* Foto principal */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 group">
        <Image
          key={fotos[ativa].url}
          src={fotos[ativa].url}
          alt={`Foto ${ativa + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 66vw"
          priority={ativa === 0}
        />

        {fotos.length > 1 && (
          <>
            <button
              onClick={anterior}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition opacity-0 group-hover:opacity-100"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={proxima}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition opacity-0 group-hover:opacity-100"
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
        <div className="flex gap-2 overflow-x-auto pb-1">
          {fotos.map((foto, i) => (
            <button
              key={foto.id}
              onClick={() => setAtiva(i)}
              className={`relative flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition ${
                i === ativa ? "border-gold-400 opacity-100" : "border-transparent opacity-60 hover:opacity-90"
              }`}
              style={i === ativa ? { borderColor: "#d8cb6a" } : undefined}
              aria-label={`Ver foto ${i + 1}`}
            >
              <Image
                src={foto.url}
                alt={`Miniatura ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
