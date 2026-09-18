"use client";

import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { BOTAO_SECUNDARIO } from "@/lib/utils";

/**
 * Botões de compartilhamento do link público (/p/[token]) da captação:
 * WhatsApp (wa.me com o texto pronto) + copiar link. No celular, quando o
 * navegador oferece o share nativo, usa a folha de compartilhamento.
 *
 * Devolve os dois botões soltos, sem casca: quem chama é que decide a grade —
 * no detalhe eles dividem a largura com o link do anúncio.
 */
export function CompartilharCaptacao({ token, endereco }: { token: string; endereco: string }) {
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
    <>
      <button
        type="button"
        onClick={compartilhar}
        title="Compartilhar no WhatsApp"
        className={BOTAO_SECUNDARIO}
      >
        <Share2 className="h-4 w-4 flex-none" />
        Compartilhar
      </button>
      <button type="button" onClick={copiar} title="Copiar link público" className={BOTAO_SECUNDARIO}>
        {copiado ? (
          <Check className="h-4 w-4 flex-none text-[#2f6b46]" />
        ) : (
          <Copy className="h-4 w-4 flex-none" />
        )}
        {copiado ? "Copiado" : "Copiar link"}
      </button>
    </>
  );
}
