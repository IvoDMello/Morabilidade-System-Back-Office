"use client";

import { createClient } from "@/lib/supabase/client";
import { processImage } from "@/lib/image";

export const BUCKET = "captacoes";

function pathFor(captacaoId: string, kind: string, ext: string) {
  const rand = crypto.randomUUID();
  return `${captacaoId}/${kind}/${rand}.${ext}`;
}

/**
 * Comprime no cliente e faz upload DIRETO ao Storage (sem passar pela API).
 * Retorna os paths para registrar em captacoes.midia.
 */
export async function uploadFoto(captacaoId: string, file: File) {
  const supabase = createClient();
  const { full, thumb } = await processImage(file);

  const fullPath = pathFor(captacaoId, "fotos", "webp");
  const thumbPath = pathFor(captacaoId, "thumbs", "webp");

  const [a, b] = await Promise.all([
    supabase.storage.from(BUCKET).upload(fullPath, full, { contentType: "image/webp" }),
    supabase.storage.from(BUCKET).upload(thumbPath, thumb, { contentType: "image/webp" }),
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;

  return { storage_path: fullPath, thumb_path: thumbPath };
}

/** Limite de tamanho do vídeo enviado pelo app (o bucket também impõe o dele). */
export const VIDEO_MAX_MB = 200;

/** Sobe o arquivo de vídeo (gravado no celular) direto ao Storage. */
export async function uploadVideo(captacaoId: string, file: File) {
  if (file.size > VIDEO_MAX_MB * 1024 * 1024) {
    throw new Error(`Vídeo acima de ${VIDEO_MAX_MB} MB. Envie um arquivo menor ou use um link.`);
  }
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
  const path = pathFor(captacaoId, "videos", ext);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "video/mp4" });
  if (error) throw error;

  return { storage_path: path };
}

export async function uploadDocumento(captacaoId: string, file: File) {
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = pathFor(captacaoId, "docs", ext);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw error;

  return {
    storage_path: path,
    nome_original: file.name,
    mime_type: file.type || null,
    tamanho_bytes: file.size,
  };
}

/** Signed URL de leitura (thumbs/fotos no board e galeria). */
export async function signedUrl(path: string, expiresIn = 300) {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
