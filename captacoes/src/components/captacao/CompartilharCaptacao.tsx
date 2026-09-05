"use client";

import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Botões de compartilhamento do link público (/p/[token]) da captação:
 * WhatsApp (wa.me com o texto pronto) + copiar link. No celular, quando o
 * navegador oferece o share nativo, usa a folha de compartilhamento.
 */
export function CompartilharCaptacao({
  token,
  endereco,
  compact = false,
}: {
  token: string;
  endereco: string;
  compact?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const url = () => `${window.location.origin}/p/${token}`;
  const texto = () => `${endereco} — veja as fotos e os detalhes: ${url()}`;

  async function copiar(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  async function compartilhar(e: React.MouseEvent) {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ title: endereco, text: endereco, url: url() });
        return;
      } catch {
        // usuário cancelou a folha nativa: nada a fazer
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto())}`, "_blank", "noopener");
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", compact && "gap-1")} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={compartilhar}
        title="Compartilhar no WhatsApp"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-[#d8e7df] bg-[#eef4f0] font-medium text-[#2f6b46] transition-colors hover:bg-[#e2efe7] active:brightness-95",
          compact ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-[13px]"
        )}
      >
        <Share2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        Compartilhar
      </button>
      <button
        type="button"
        onClick={copiar}
        title="Copiar link público"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-[#e2e3dd] bg-white font-medium text-[#4a4d43] transition-colors hover:bg-[#f5f6f1] active:bg-[#eceee8]",
          compact ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-[13px]"
        )}
      >
        {copiado ? (
          <Check className={cn("text-[#2f6b46]", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        ) : (
          <Copy className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        )}
        {copiado ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}
