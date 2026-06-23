"use client";

import { useEffect, useMemo } from "react";
import { ImagePlus, FileUp, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Seleciona fotos/documentos ANTES de existir o cartão (staging em memória).
 * Os arquivos só sobem ao Storage após o insert da captação.
 */
export function AnexosPicker({
  fotos,
  setFotos,
  docs,
  setDocs,
}: {
  fotos: File[];
  setFotos: (f: File[]) => void;
  docs: File[];
  setDocs: (f: File[]) => void;
}) {
  const previews = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              setFotos([...fotos, ...Array.from(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" asChild>
            <span><ImagePlus className="h-4 w-4" /> Fotos</span>
          </Button>
        </label>
        <label>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              setDocs([...docs, ...Array.from(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" asChild>
            <span><FileUp className="h-4 w-4" /> Documentos</span>
          </Button>
        </label>
      </div>

      {fotos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {fotos.map((f, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setFotos(fotos.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white"
                aria-label="Remover foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {docs.length > 0 && (
        <ul className="space-y-1.5">
          {docs.map((d, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{d.name}</span>
              <button
                type="button"
                onClick={() => setDocs(docs.filter((_, j) => j !== i))}
                aria-label="Remover documento"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
