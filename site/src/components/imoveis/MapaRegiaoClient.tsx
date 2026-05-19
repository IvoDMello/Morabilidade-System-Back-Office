"use client";

import dynamic from "next/dynamic";

const MapaRegiao = dynamic(() => import("./MapaRegiao"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-sm text-slate-400">
      Carregando mapa…
    </div>
  ),
});

interface Props {
  lat: number;
  lng: number;
  raioMetros?: number;
}

export default function MapaRegiaoClient(props: Props) {
  return <MapaRegiao {...props} />;
}