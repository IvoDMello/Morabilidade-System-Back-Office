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

/** O que pode abrir dentro do navegador: nada disso executa script. */
function abreNoNavegador(mime: string): boolean {
  return (
    ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"].includes(mime) ||
    mime.startsWith("audio/") ||
    mime.startsWith("video/")
  );
}

/** Cabeçalhos do proxy de mídia.
 *
 * O mime-type vem de quem mandou a mensagem: um contato pode enviar um
 * documento `text/html` ou uma imagem `image/svg+xml`. Servido como veio, o
 * arquivo abriria no domínio do atendimento com a sessão do atendente e o
 * script dele rodaria ali. Então só imagem comum, áudio, vídeo e PDF abrem
 * no navegador; o resto vai como download, com `nosniff` para o navegador
 * não adivinhar outro tipo. */
export function mediaResponseHeaders(path: string, storedMime: string | null | undefined): Record<string, string> {
  const declarado = storedMime?.split(";")[0].trim().toLowerCase();
  const mime =
    declarado && declarado !== "application/octet-stream" ? declarado : mimeFromPath(path);
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    // Privado: só o navegador do atendente logado cacheia, nunca um CDN.
    "Cache-Control": "private, max-age=86400",
  };
  if (abreNoNavegador(mime)) {
    headers["Content-Type"] = mime;
  } else {
    const nome = (path.split("/").pop() ?? "").replace(/[^\w.-]+/g, "_") || "arquivo";
    headers["Content-Type"] = "application/octet-stream";
    headers["Content-Disposition"] = `attachment; filename="${nome}"`;
  }
  return headers;
}

/** Fonte (`src`) de exibição de uma mídia recebida.
 * - URL absoluta (modo mock / mídia já hospedada) → usada direto.
 * - Caminho no bucket (modo cloud-api) → servido pelo proxy autenticado. */
export function mediaSrc(message: Pick<WhatsAppMessage, "mediaUrl">): string | null {
  if (!message.mediaUrl) return null;
  if (/^https?:\/\//i.test(message.mediaUrl)) return message.mediaUrl;
  return `/api/whatsapp/media?path=${encodeURIComponent(message.mediaUrl)}`;
}
