import Link from "next/link";
import Image from "next/image";
import { BedDouble, Bath, Ruler, MapPin, Car } from "lucide-react";
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
      if (imovel.valor_locacao) partes.push(`${formatarMoeda(imovel.valor_locacao)}/mês`);
      return partes.join(" · ") || null;
    }
    return null;
  }

  return (
    <Link
      href={`/imoveis/${imovel.codigo}`}
      className="group flex flex-col rounded-xl overflow-hidden border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Foto */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {imovel.foto_capa ? (
          <Image
            src={imovel.foto_capa}
            alt={`${labelTipoImovel(imovel.tipo_imovel)} em ${imovel.bairro}, ${imovel.cidade}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm">
            Sem foto
          </div>
        )}
        {/* Badge negócio */}
        <span
          className="absolute top-2 left-2 px-2.5 py-1 text-xs font-semibold rounded-full text-white shadow"
          style={{ backgroundColor: "#585a4f" }}
        >
          {labelTipoNegocio(imovel.tipo_negocio)}
        </span>
        {/* Tags */}
        {imovel.tags.length > 0 && (
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
            {imovel.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-0.5 text-xs font-medium rounded-full text-white shadow"
                style={{ backgroundColor: tag.cor ?? "#6b7280" }}
              >
                {tag.nome}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <p className="text-xs text-slate-400 font-mono">{imovel.codigo}</p>
        <h3 className="font-semibold text-slate-800 leading-snug">
          {labelTipoImovel(imovel.tipo_imovel)}
        </h3>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">
            {imovel.bairro}, {imovel.cidade}
          </span>
        </div>

        {/* Características */}
        <div className="flex items-center flex-wrap gap-3 text-xs text-slate-500 mt-1">
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

        {/* Preço */}
        <div className="mt-auto pt-3 border-t border-slate-50">
          {preco() ? (
            <p className="font-bold text-lg" style={{ color: "#585a4f" }}>
              {preco()}
            </p>
          ) : (
            <p className="text-sm text-slate-400 italic">Consulte o valor</p>
          )}
        </div>
      </div>
    </Link>
  );
}
