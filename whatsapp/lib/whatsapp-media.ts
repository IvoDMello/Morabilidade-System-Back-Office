import type { WhatsAppMessage, WhatsAppMessageType } from "@/types/whatsapp";

/** Tipos de mensagem que carregam uma mídia (imagem/áudio/vídeo/documento/figurinha). */
export const MEDIA_MESSAGE_TYPES = [
  "image",
  "audio",
  "video",
  "document",
  "sticker",
] as const;

export type MediaMessageType = (typeof MEDIA_MESSAGE_TYPES)[number];

export function isMediaType(type: WhatsAppMessageType): type is MediaMessageType {
  return (MEDIA_MESSAGE_TYPES as readonly string[]).includes(type);
}

/** Rótulo curto (com emoji) usado na prévia da lista e na notificação push
 * quando a mídia não tem legenda. */
export function mediaLabel(type: WhatsAppMessageType): string {
  switch (type) {
    case "image":
      return "📷 Foto";
    case "audio":
      return "🎧 Áudio";
    case "video":
      return "🎥 Vídeo";
    case "document":
      return "📄 Documento";
    case "sticker":
      return "🈶 Figurinha";
    case "unsupported":
      return "Mensagem não suportada";
    default:
      return "";
  }
}

/** Prévia textual de uma mensagem para a lista de conversas/notificação:
 * usa a legenda quando existe, senão o rótulo da mídia. */
export function messagePreview(type: WhatsAppMessageType, body: string): string {
  const caption = body.trim();
  if (caption) return caption;
  if (isMediaType(type) || type === "unsupported") return mediaLabel(type);
  return caption;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/amr": "amr",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
};

/** Extensão de arquivo a partir do mime-type da Meta (fallback: subtipo). */
export function extFromMime(mime: string | null | undefined): string {
  if (!mime) return "bin";
  const clean = mime.split(";")[0].trim().toLowerCase();
  if (EXT_BY_MIME[clean]) return EXT_BY_MIME[clean];
  const subtype = clean.split("/")[1];
  return subtype ? subtype.replace(/[^a-z0-9]/g, "") || "bin" : "bin";
}

const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime]),
);

/** Mime-type a partir da extensão do caminho salvo (usado pelo proxy de mídia). */
export function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/** Fonte (`src`) de exibição de uma mídia recebida.
 * - URL absoluta (modo mock / mídia já hospedada) → usada direto.
 * - Caminho no bucket (modo cloud-api) → servido pelo proxy autenticado. */
export function mediaSrc(message: Pick<WhatsAppMessage, "mediaUrl">): string | null {
  if (!message.mediaUrl) return null;
  if (/^https?:\/\//i.test(message.mediaUrl)) return message.mediaUrl;
  return `/api/whatsapp/media?path=${encodeURIComponent(message.mediaUrl)}`;
}
