"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, MessageCircle, Link2, Check } from "lucide-react";
import { getOrCreateSessionId, sendBeaconJSON } from "@/lib/session";

interface Props {
  codigo: string;
  titulo: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://morabilidade.com";

export function CompartilharButton({ codigo, titulo }: Props) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const url = `${SITE_URL}/imoveis/${codigo}`;
  const texto = `${titulo} (${codigo}) — Morabilidade`;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function trackShare(canal: "whatsapp" | "web_share" | "copy_link") {
    sendBeaconJSON("/publico/share", {
      session_id: getOrCreateSessionId(),
      imovel_codigo: codigo,
      canal,
    });
  }

  async function compartilharNativo() {
    if (typeof navigator === "undefined" || !("share" in navigator)) {
      setAberto(true);
      return;
    }
    try {
      await navigator.share({ title: texto, text: texto, url });
      trackShare("web_share");
    } catch {
      // Usuário cancelou — não é erro.
    }
  }

  function compartilharWhatsApp(e: React.MouseEvent) {
    e.preventDefault();
    trackShare("whatsapp");
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${texto}\n${url}`)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    setAberto(false);
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
      trackShare("copy_link");
    } catch {
      // Sem permissão de clipboard — silencioso.
    }
  }

  const temShareNativo =
    typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={temShareNativo ? compartilharNativo : () => setAberto((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
      >
        <Share2 className="w-3.5 h-3.5" />
        Compartilhar
      </button>

      {aberto && !temShareNativo && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <button
            type="button"
            onClick={compartilharWhatsApp}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition text-left"
          >
            <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={copiarLink}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition text-left border-t border-slate-100"
          >
            {copiado ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                Link copiado
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 text-slate-500" />
                Copiar link
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
