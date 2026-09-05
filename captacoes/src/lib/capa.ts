"use client";

import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/storage";

// Cache por sessão de signed URLs de thumbs/capas: evita re-assinar a mesma
// imagem a cada render/instância (board desktop, mobile e pauta compartilham).
const cache = new Map<string, string>();
const pendentes = new Map<string, Promise<string>>();

/** Signed URL da capa/thumb, com cache e dedupe de requisições em voo. */
export function useCapaUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(path ? cache.get(path) ?? null : null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const pronto = cache.get(path);
    if (pronto) {
      setUrl(pronto);
      return;
    }
    let ativo = true;
    let p = pendentes.get(path);
    if (!p) {
      p = signedUrl(path, 3600).then((u) => {
        cache.set(path, u);
        pendentes.delete(path);
        return u;
      });
      pendentes.set(path, p);
    }
    p.then((u) => ativo && setUrl(u)).catch(() => pendentes.delete(path));
    return () => {
      ativo = false;
    };
  }, [path]);

  return url;
}
