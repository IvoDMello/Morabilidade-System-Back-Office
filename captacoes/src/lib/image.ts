"use client";

import imageCompression from "browser-image-compression";

/**
 * Processa uma foto NO CLIENTE antes do upload (RF11 / RNF03).
 * Gera duas versões em WebP: a grande (detalhe) e o thumbnail (board).
 * Mantém o servidor leve — sem `sharp`, sem cota de Image Transformation.
 */
export interface ProcessedImage {
  full: File; // ~1600px
  thumb: File; // ~400px
}

const FULL = { maxWidthOrHeight: 1600, initialQuality: 0.8 };
const THUMB = { maxWidthOrHeight: 400, initialQuality: 0.7 };

export async function processImage(file: File): Promise<ProcessedImage> {
  const base = { useWebWorker: true, fileType: "image/webp" as const };
  const [full, thumb] = await Promise.all([
    imageCompression(file, { ...base, ...FULL }),
    imageCompression(file, { ...base, ...THUMB }),
  ]);

  const name = file.name.replace(/\.[^.]+$/, "");
  return {
    full: new File([full], `${name}.webp`, { type: "image/webp" }),
    thumb: new File([thumb], `${name}-thumb.webp`, { type: "image/webp" }),
  };
}
