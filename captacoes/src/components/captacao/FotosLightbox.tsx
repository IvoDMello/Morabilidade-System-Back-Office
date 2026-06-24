"use client";

import { useEffect, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import { toast } from "sonner";
import { signedUrl } from "@/lib/storage";

export interface FotoRef {
  id: string;
  storage_path: string | null;
}

/**
 * Visualizador de fotos em tela cheia: swipe entre fotos, pinch-to-zoom e
 * duplo-toque. Resolve as URLs assinadas ao abrir. `index === null` = fechado.
 */
export function FotosLightbox({
  fotos,
  index,
  onClose,
}: {
  fotos: FotoRef[];
  index: number | null;
  onClose: () => void;
}) {
  const [slides, setSlides] = useState<{ src: string; width: number; height: number }[]>([]);

  useEffect(() => {
    if (index === null) {
      setSlides([]);
      return;
    }
    let ativo = true;
    (async () => {
      try {
        const urls = await Promise.all(
          fotos.map((f) => (f.storage_path ? signedUrl(f.storage_path, 3600) : Promise.resolve("")))
        );
        // Mede as dimensões reais: o lightbox precisa delas para ocupar a tela
        // inteira e liberar o zoom além de 100%.
        const comDims = await Promise.all(
          urls.map(
            (src) =>
              new Promise<{ src: string; width: number; height: number }>((resolve) => {
                if (!src) return resolve({ src, width: 1600, height: 1200 });
                const img = new window.Image();
                img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
                img.onerror = () => resolve({ src, width: 1600, height: 1200 });
                img.src = src;
              })
          )
        );
        if (ativo) setSlides(comDims);
      } catch {
        if (ativo) toast.error("Não foi possível abrir as fotos.");
      }
    })();
    return () => {
      ativo = false;
    };
  }, [index, fotos]);

  if (index === null || slides.length === 0) return null;

  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      slides={slides}
      plugins={[Zoom, Counter]}
      zoom={{ maxZoomPixelRatio: 4, doubleTapDelay: 250, scrollToZoom: true }}
      carousel={{ finite: true, preload: 2, padding: 0, imageFit: "contain" }}
      controller={{ closeOnBackdropClick: true }}
      styles={{ container: { backgroundColor: "rgba(0,0,0,0.92)" } }}
    />
  );
}
