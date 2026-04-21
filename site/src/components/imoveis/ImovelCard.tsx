import Link from "next/link";
import Image from "next/image";
import { BedDouble, Ruler, MapPin } from "lucide-react";
import type { ImovelCard as ImovelCardType } from "@/types";
import { formatarMoeda, labelTipoImovel, labelTipoNegocio } from "@/lib/utils";

export function ImovelCard({ imovel }: { imovel: ImovelCardType }) {
  function preco(): string | null {
    if (imovel.tipo_negocio === "venda" && imovel.valor_venda)
      return formatarMoeda(imovel.valor_venda);
    if (imovel.tipo_negocio === "locacao" && imovel.valor_locacao)
      return `${formatarMoeda(imovel.valor_locacao)}/mês`;
    if (imovel.tipo_negocio === "ambos") {
      const partes: string[] = [];
      if (imovel.valor_venda) partes.push(formatarMoeda(imovel.valor_venda));
      if (imovel.valor_locacao)
        partes.push(`${formatarMoeda(imovel.valor_locacao)}/mês`);
      return partes.join(" · ") || null;
    }
    return null;
  }

  const negocioLabel = labelTipoNegocio(imovel.tipo_negocio);
  const isVenda = imovel.tipo_negocio === "venda" || imovel.tipo_negocio === "ambos";

  return (
    <Link
      href={`/imoveis/${imovel.codigo}`}
      className="group flex flex-col rounded-2xl overflow-hidden bg-white shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5"
    >
      {/* Foto */}
      <div className="relative aspect-[16/11] bg-slate-100 overflow-hidden">
        {imovel.foto_capa ? (
          <Image
            src={imovel.foto_capa}
            alt={`${labelTipoImovel(imovel.tipo_imovel)} em ${imovel.bairro}, ${imovel.cidade}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
            <Ruler className="w-8 h-8 opacity-30" />
            <span className="text-xs">Sem foto</span>
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Badge negócio */}
        <span
          className="absolute top-3 left-3 px-2.5 py-1 text-xs font-bold rounded-full text-white shadow-sm tracking-wide"
          style={{ backgroundColor: isVenda ? "#585a4f" : "#4a4d43" }}
        >
          {negocioLabel}
        </span>

        {/* Tags */}
        {imovel.tags.length > 0 && (
          <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
            {imovel.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-0.5 text-xs font-semibold rounded-full text-white shadow-sm"
                style={{ backgroundColor: tag.cor ?? "#6b7280" }}
              >
                {tag.nome}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Tipo + código */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-800 text-base leading-snug">
            {labelTipoImovel(imovel.tipo_imovel)}
          </h3>
          <span className="text-xs text-slate-300 font-mono flex-shrink-0 mt-0.5">
            {imovel.codigo}
          </span>
        </div>

        {/* Localização */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">
            {imovel.bairro}, {imovel.cidade}
          </span>
        </div>

        {/* Características */}
        <div className="flex items-center flex-wrap gap-3 text-xs text-slate-500">
          {imovel.dormitorios != null && (
            <span className="flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5 text-slate-400" />
              {imovel.dormitorios} dorm.
            </span>
          )}
          {imovel.area_util != null && (
            <span className="flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5 text-slate-400" />
              {imovel.area_util} m²
            </span>
          )}
        </div>

        {/* Preço */}
        <div className="mt-auto pt-3 border-t border-slate-100 flex items-end justify-between">
          {preco() ? (
            <div>
              {imovel.tipo_negocio === "locacao" && (
                <span className="text-xs text-slate-400 block mb-0.5">A partir de</span>
              )}
              <p className="font-bold text-xl leading-none" style={{ color: "#585a4f" }}>
                {preco()}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">Consulte o valor</p>
          )}
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-lg"
            style={{ backgroundColor: "#f5f5f3", color: "#585a4f" }}
          >
            Ver mais →
          </span>
        </div>
      </div>
    </Link>
  );
}
