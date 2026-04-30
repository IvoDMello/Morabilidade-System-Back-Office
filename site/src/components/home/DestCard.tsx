import Link from "next/link";
import Image from "next/image";
import { MapPin, BedDouble, Ruler } from "lucide-react";
import type { ImovelCard } from "@/types";
import { formatarMoeda, labelTipoImovel, labelTipoNegocio } from "@/lib/utils";

export function DestCard({ imovel }: { imovel: ImovelCard }) {
  const isVenda = imovel.tipo_negocio === "venda" || imovel.tipo_negocio === "ambos";

  function preco(): string | null {
    if (imovel.tipo_negocio === "venda" && imovel.valor_venda)
      return formatarMoeda(imovel.valor_venda);
    if (imovel.tipo_negocio === "locacao" && imovel.valor_locacao)
      return `${formatarMoeda(imovel.valor_locacao)}/mês`;
    if (imovel.tipo_negocio === "ambos") {
      if (imovel.valor_venda) return formatarMoeda(imovel.valor_venda);
      if (imovel.valor_locacao) return `${formatarMoeda(imovel.valor_locacao)}/mês`;
    }
    return null;
  }

  return (
    <Link
      href={`/imoveis/${imovel.codigo}`}
      className="group flex-shrink-0 block overflow-hidden transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(88,90,79,0.18)] hover:border-transparent"
      style={{
        width: "clamp(220px, 75vw, 320px)",
        borderRadius: 14,
        backgroundColor: "#fcfcfc",
        border: "1px solid #e4e1d6",
        boxShadow: "0 2px 10px rgba(88,90,79,0.07)",
        textDecoration: "none",
      }}
    >
      {/* Image */}
      <div
        className="relative overflow-hidden"
        style={{ paddingTop: "65%", backgroundColor: "#e0ddd4" }}
      >
        {imovel.foto_capa ? (
          <Image
            src={imovel.foto_capa}
            alt={`${labelTipoImovel(imovel.tipo_imovel)} em ${imovel.bairro}`}
            fill
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 75vw, 320px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Ruler className="w-8 h-8 opacity-20" style={{ color: "#585a4f" }} />
          </div>
        )}
        <span
          className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full"
          style={{
            backgroundColor: isVenda ? "#d8cb6a" : "#585a4f",
            color: isVenda ? "#3e4037" : "#fcfcfc",
          }}
        >
          {labelTipoNegocio(imovel.tipo_negocio)}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="text-xs font-semibold mb-1" style={{ color: "#2d2f28" }}>
          {labelTipoImovel(imovel.tipo_imovel)}
        </div>
        <div
          className="flex items-center gap-1 text-xs mb-2.5 truncate"
          style={{ color: "#7a7c72" }}
        >
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {imovel.bairro}, {imovel.cidade}
        </div>
        <div className="flex items-center gap-3 text-xs mb-3" style={{ color: "#7a7c72" }}>
          {imovel.dormitorios != null && (
            <span className="flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5" />
              {imovel.dormitorios} dorm.
            </span>
          )}
          {imovel.area_util != null && (
            <span className="flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5" />
              {imovel.area_util} m²
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          {preco() ? (
            <div
              className="font-serif font-medium leading-tight"
              style={{ fontSize: 17, color: "#2d2f28" }}
            >
              {preco()}
            </div>
          ) : (
            <p className="text-sm italic" style={{ color: "#7a7c72" }}>
              Consulte
            </p>
          )}
          <span
            className="text-xs font-semibold flex items-center gap-1"
            style={{ color: "#585a4f" }}
          >
            Ver mais →
          </span>
        </div>
      </div>
    </Link>
  );
}
