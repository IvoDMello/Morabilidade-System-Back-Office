"use client";

import { Youtube } from "lucide-react";
import { getOrCreateSessionId, sendBeaconJSON } from "@/lib/session";

interface Props {
  codigo: string;
  url: string;
}

export function VideoYoutubeButton({ codigo, url }: Props) {
  // Mesma métrica do botão do Instagram (imovel_video_clicks): o que o painel
  // acompanha é o interesse pelo vídeo do imóvel, não por onde ele foi visto.
  function track() {
    sendBeaconJSON("/publico/video", {
      session_id: getOrCreateSessionId(),
      imovel_codigo: codigo,
    });
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={track}
      className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
      style={{ background: "linear-gradient(135deg, #3e4037 0%, #585a4f 72%, #d8cb6a 100%)" }}
    >
      <Youtube className="w-4 h-4" /> Vídeo Tour no YouTube
    </a>
  );
}
