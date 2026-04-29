"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Home, Building2, MapPin, ChevronDown } from "lucide-react";

type TipoNegocio = "venda" | "locacao" | "";

const TIPOS_IMOVEL = [
  { value: "", label: "Todos os tipos" },
  { value: "apartamento", label: "Apartamento" },
  { value: "cobertura", label: "Cobertura" },
  { value: "casa", label: "Casa" },
  { value: "kitnet", label: "Kitnet / Studio" },
  { value: "terreno", label: "Terreno" },
  { value: "sala", label: "Sala comercial" },
  { value: "loja", label: "Loja" },
];

export function HeroSearch() {
  const router = useRouter();
  const [tipoNegocio, setTipoNegocio] = useState<TipoNegocio>("");
  const [tipoImovel, setTipoImovel] = useState("");
  const [bairro, setBairro] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (tipoNegocio) params.set("tipo_negocio", tipoNegocio);
    if (tipoImovel) params.set("tipo_imovel", tipoImovel);
    if (bairro.trim()) params.set("bairro", bairro.trim());
    const qs = params.toString();
    router.push(`/imoveis${qs ? `?${qs}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      {/* Toggle Comprar / Alugar */}
      <div className="flex items-center justify-center mb-3">
        <div
          className="inline-flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-full p-1"
          role="tablist"
        >
          <SegmentButton
            active={tipoNegocio === ""}
            onClick={() => setTipoNegocio("")}
          >
            Tudo
          </SegmentButton>
          <SegmentButton
            active={tipoNegocio === "venda"}
            onClick={() => setTipoNegocio("venda")}
            icon={<Home className="w-3.5 h-3.5" />}
          >
            Comprar
          </SegmentButton>
          <SegmentButton
            active={tipoNegocio === "locacao"}
            onClick={() => setTipoNegocio("locacao")}
            icon={<Building2 className="w-3.5 h-3.5" />}
          >
            Alugar
          </SegmentButton>
        </div>
      </div>

      {/* Card de busca */}
      <div className="bg-white rounded-2xl shadow-xl shadow-black/30 p-2 sm:p-2.5 flex flex-col sm:flex-row gap-2 items-stretch">
        {/* Tipo de imóvel */}
        <div className="relative flex-1 min-w-0">
          <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            value={tipoImovel}
            onChange={(e) => setTipoImovel(e.target.value)}
            className="w-full pl-10 pr-9 py-3 sm:py-3.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border-0 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 cursor-pointer appearance-none transition"
          >
            {TIPOS_IMOVEL.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {/* Bairro / cidade */}
        <div className="relative flex-1 min-w-0">
          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
            placeholder="Ipanema, Leblon, Botafogo..."
            className="w-full pl-10 pr-3 py-3 sm:py-3.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border-0 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 placeholder:text-slate-400 placeholder:font-normal transition"
          />
        </div>

        {/* Botão Buscar */}
        <button
          type="submit"
          className="flex items-center justify-center gap-2 px-6 py-3 sm:py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 hover:shadow-lg whitespace-nowrap"
          style={{ backgroundColor: "#d8cb6a", color: "#2e302a" }}
        >
          <Search className="w-4 h-4" />
          Buscar
        </button>
      </div>
    </form>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
        active ? "shadow-md" : "text-white/70 hover:text-white"
      }`}
      style={
        active
          ? { backgroundColor: "#d8cb6a", color: "#2e302a" }
          : undefined
      }
    >
      {icon}
      {children}
    </button>
  );
}
