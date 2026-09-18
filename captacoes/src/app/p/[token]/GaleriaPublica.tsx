"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";

interface Slide {
  src: string;
  width?: number;
  height?: number;
}

/**
 * As fotos do imóvel na página que vai por WhatsApp. Tocar numa foto abre o
 * álbum em tela cheia, onde o cliente arrasta para o lado até a próxima e
 * pinça para ampliar — antes cada foto era um link para a URL assinada, que
 * abria a imagem solta numa aba do navegador e deixava o cliente sem gesto
 * nenhum para chegar na seguinte.
 *
 * A capa e a grade ficam em pontos distintos da página, separadas pelo título
 * e pelos valores; daí o `children`: esse miolo continua vindo pronto do
 * servidor e só atravessa este componente, que existe para guardar qual foto
 * está aberta.
 */
export function GaleriaPublica({
  fotos,
  capaIndex,
  endereco,
  children,
}: {
  fotos: string[];
  capaIndex: number;
  endereco: string;
  children: React.ReactNode;
}) {
  const [aberta, setAberta] = useState<number | null>(null);
  const [slides, setSlides] = useState<Slide[]>(() => fotos.map((src) => ({ src })));
  const medidas = useRef(new Set<number>());

  // O zoom só passa de 100% quando o lightbox sabe o tamanho real do arquivo,
  // e isso só se descobre baixando a imagem. Medimos a foto aberta e as duas
  // vizinhas — as mesmas que o carrossel já carrega — em vez do álbum inteiro,
  // que no 4G do cliente seriam dezenas de fotos em tamanho cheio de uma vez.
  useEffect(() => {
    if (aberta === null) return;
    let ativo = true;
    const vizinhas = [aberta - 1, aberta, aberta + 1].filter((i) => i >= 0 && i < fotos.length);
    for (const i of vizinhas) {
      if (medidas.current.has(i)) continue;
      medidas.current.add(i);
      const img = new window.Image();
      img.onload = () => {
        if (!ativo) return;
        setSlides((atual) =>
          atual.map((s, j) =>
            j === i ? { ...s, width: img.naturalWidth, height: img.naturalHeight } : s
          )
        );
      };
      img.src = fotos[i];
    }
    return () => {
      ativo = false;
    };
  }, [aberta, fotos]);

  const capa = fotos[capaIndex];
  const demais = fotos.map((url, i) => ({ url, i })).filter(({ i }) => i !== capaIndex);

  return (
    <>
      {/* Capa */}
      {capa && (
        <button
          type="button"
          onClick={() => setAberta(capaIndex)}
          aria-label="Ampliar a foto de capa"
          className="relative mt-4 block aspect-[16/10] w-full cursor-zoom-in overflow-hidden rounded-2xl bg-[#e2e3dd] shadow-[0_10px_30px_-18px_rgba(46,48,42,0.4)]"
        >
          <Image
            src={capa}
            alt={endereco}
            fill
            priority
            sizes="(max-width: 672px) 100vw, 672px"
            className="object-cover"
          />
        </button>
      )}

      {children}

      {/* Galeria */}
      {demais.length > 0 && (
        <>
          <h2 className="mt-7 font-serif text-lg font-semibold text-[#2e302a]">Fotos</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {demais.map(({ url, i }, pos) => (
              <button
                type="button"
                key={i}
                onClick={() => setAberta(i)}
                aria-label={`Ampliar a foto ${pos + 2} de ${fotos.length}`}
                className="relative aspect-[4/3] cursor-zoom-in overflow-hidden rounded-xl bg-[#e2e3dd]"
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  loading="lazy"
                  sizes="(max-width: 672px) 50vw, 336px"
                  className="object-cover transition-transform duration-300 hover:scale-[1.03]"
                />
              </button>
            ))}
          </div>
        </>
      )}

      {aberta !== null && (
        <Lightbox
          open
          close={() => setAberta(null)}
          index={aberta}
          on={{ view: ({ index }) => setAberta(index) }}
          slides={slides}
          plugins={[Zoom, Counter]}
          zoom={{ maxZoomPixelRatio: 4, doubleTapDelay: 250, scrollToZoom: true }}
          carousel={{ finite: true, preload: 2, padding: 0, imageFit: "contain" }}
          controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
          styles={{ container: { backgroundColor: "rgba(0,0,0,0.92)" } }}
        />
      )}
    </>
  );
}
