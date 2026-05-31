"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { getOrCreateSessionId, sendBeaconJSON } from "@/lib/session";

const STORAGE_KEY = "mora_favoritos";

function lerFavoritos(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function salvarFavoritos(lista: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // localStorage cheio ou bloqueado — silencioso.
  }
}

interface Props {
  codigo: string;
  /** "icon" pra card (canto da foto) ou "pill" pra ficha (lado do título). */
  variant?: "icon" | "pill";
}

export function FavoritoButton({ codigo, variant = "icon" }: Props) {
  const [ativo, setAtivo] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setAtivo(lerFavoritos().includes(codigo));
    setMontado(true);
  }, [codigo]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const atual = lerFavoritos();
    const proximo = ativo ? atual.filter((c) => c !== codigo) : [...atual, codigo];
    salvarFavoritos(proximo);
    setAtivo(!ativo);
    sendBeaconJSON("/publico/favorito", {
      session_id: getOrCreateSessionId(),
      imovel_codigo: codigo,
      acao: ativo ? "remove" : "add",
    });
  }

  if (!montado) {
    // Evita hydration mismatch — estado real só sai depois do mount.
    return variant === "pill" ? (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400">
        <Heart className="w-3.5 h-3.5" /> Favoritar
      </span>
    ) : (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/90 shadow-sm">
        <Heart className="w-4 h-4 text-slate-400" />
      </span>
    );
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={ativo}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
          ativo
            ? "bg-rose-50 text-rose-600 border border-rose-200"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        <Heart
          className="w-3.5 h-3.5"
          fill={ativo ? "currentColor" : "none"}
        />
        {ativo ? "Favorito" : "Favoritar"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={ativo ? "Remover dos favoritos" : "Salvar nos favoritos"}
      aria-pressed={ativo}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/95 shadow-sm hover:scale-110 transition-transform"
    >
      <Heart
        className={`w-4 h-4 transition-colors ${ativo ? "text-rose-500" : "text-slate-500"}`}
        fill={ativo ? "currentColor" : "none"}
      />
    </button>
  );
}
