// Loader custom do Next/Image que usa o Image Transformation do Supabase Storage
// em vez da otimização da Vercel (que estourou cota, erro 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED).
//
// Funciona reescrevendo:
//   .../storage/v1/object/public/{bucket}/{path}
// para:
//   .../storage/v1/render/image/public/{bucket}/{path}?width=W&quality=Q
//
// Qualquer URL que não seja do Supabase é devolvida sem mudança, assim logos
// locais (/public/...) e imagens externas continuam funcionando.

export default function supabaseLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (!src.includes("/storage/v1/object/public/")) {
    return src;
  }

  const semQuery = src.split("?")[0];
  const renderUrl = semQuery.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/",
  );

  const params = new URLSearchParams({
    width: String(width),
    quality: String(quality ?? 75),
    resize: "contain",
  });
  return `${renderUrl}?${params.toString()}`;
}
