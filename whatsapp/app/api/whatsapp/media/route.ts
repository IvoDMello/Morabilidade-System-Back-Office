import { dataSource } from "@/services/data";
import { mimeFromPath } from "@/lib/whatsapp-media";

/**
 * Proxy autenticado das mídias recebidas do WhatsApp. As mídias vivem num
 * bucket PRIVADO do Supabase Storage (ver migration 0016); esta rota baixa o
 * objeto com a service_role e o entrega ao navegador. Fica atrás do login
 * (middleware.ts) — diferente do webhook, não é uma rota pública.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  // Só caminhos dentro do bucket (conversa/arquivo) — sem escapar diretório.
  if (!path || path.includes("..") || path.startsWith("/")) {
    return new Response("Bad Request", { status: 400 });
  }

  if (!dataSource.whatsapp.getMediaObject) {
    return new Response("Not Found", { status: 404 });
  }

  const object = await dataSource.whatsapp.getMediaObject(path);
  if (!object) return new Response("Not Found", { status: 404 });

  const contentType =
    object.mimeType && object.mimeType !== "application/octet-stream"
      ? object.mimeType
      : mimeFromPath(path);

  return new Response(object.data, {
    headers: {
      "Content-Type": contentType,
      // Privado: só o navegador do atendente logado cacheia, nunca um CDN.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
