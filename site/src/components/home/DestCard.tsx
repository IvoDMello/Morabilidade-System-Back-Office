import Link from "next/link";
import { MapPin, BedDouble, Ruler } from "lucide-react";
import type { ImovelCard } from "@/types";
import { formatarMoeda, labelTipoImovel, labelTipoNegocio } from "@/lib/utils";
import { CardFotoCarousel } from "@/components/imoveis/CardFotoCarousel";

export function DestCard({ imovel }: { imovel: ImovelCard }) {
  const isVenda = imovel.tipo_negocio === "venda" || imovel.tipo_negocio === "ambos";
  const tagVendido = imovel.tags.find((t) => t.nome.trim().toLowerCase() === "vendido");
  const outrasTags = imovel.tags.filter((t) => t !== tagVendido);

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
      // Borda e sombra ficam em classe, e não no style inline: inline venceria
      // o hover: e era por isso que o card não reagia ao mouse. As sombras são
      // os tokens do projeto (tailwind.config), os mesmos do ImovelCard.
      className={
        "group flex-shrink-0 block overflow-hidden " +
        "border border-[#e4e1d6] shadow-card " +
        "transition-[transform,box-shadow,border-color] duration-300 ease-out " +
        "hover:-translate-y-1 hover:border-transparent hover:shadow-card-hover"
      }
      style={{
        // Teto de 320px: o trilho do carrossel tem 1024px úteis no desktop
        // (container 1176 − 96 de padding − 56 do wrapper das setas), então
        // 3 cards + 2 gaps de 20px só cabem até 328px. Acima disso os cards
        // das pontas aparecem cortados.
        width: "clamp(220px, 70vw, 320px)",
        borderRadius: 14,
        backgroundColor: "#fcfcfc",
        textDecoration: "none",
        scrollSnapAlign: "center",
      }}
    >
      {/* Image */}
      <div
        className="relative overflow-hidden"
        style={{ paddingTop: "65%", backgroundColor: "#e0ddd4" }}
      >
        {imovel.foto_capa ? (
          <CardFotoCarousel
            fotos={[imovel.foto_capa]}
            alt={`${labelTipoImovel(imovel.tipo_imovel)} em ${imovel.bairro}`}
            sizes="(max-width: 640px) 75vw, 320px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Ruler className="w-8 h-8 opacity-20" style={{ color: "#585a4f" }} />
          </div>
        )}
        {tagVendido ? (
          <span
            className="absolute top-3.5 left-3.5 text-[10.5px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full text-white shadow-sm"
            style={{ backgroundColor: tagVendido.cor ?? "#6b7280" }}
          >
            {tagVendido.nome}
          </span>
        ) : (
          <span
            className="absolute top-3.5 left-3.5 text-[10.5px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full"
            style={{
              backgroundColor: isVenda ? "#d8cb6a" : "#585a4f",
              color: isVenda ? "#3e4037" : "#fcfcfc",
            }}
          >
            {labelTipoNegocio(imovel.tipo_negocio)}
          </span>
        )}
        {outrasTags.length > 0 && (
          <div className="absolute top-3.5 right-3.5 flex flex-col gap-1 items-end">
            {outrasTags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="text-[10.5px] font-bold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full text-white shadow-sm"
                style={{ backgroundColor: tag.cor ?? "#6b7280" }}
              >
                {tag.nome}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        <div className="font-semibold mb-1.5" style={{ fontSize: 16, color: "#2d2f28" }}>
          {labelTipoImovel(imovel.tipo_imovel)}
        </div>
        <div
          className="flex items-center gap-1.5 mb-3 truncate"
          style={{ fontSize: 13.5, color: "#7a7c72" }}
        >
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          {imovel.bairro}, {imovel.cidade}
        </div>
        <div
          className="flex items-center gap-4"
          style={{ fontSize: 13, fontWeight: 500, color: "#585a4f" }}
        >
          {imovel.dormitorios != null && (
            <span className="flex items-center gap-1.5">
              <BedDouble className="w-4 h-4" />
              {imovel.dormitorios} dorm.
            </span>
          )}
          {imovel.area_util != null && (
            <span className="flex items-center gap-1.5">
              <Ruler className="w-4 h-4" />
              {imovel.area_util} m²
            </span>
          )}
        </div>
        <div
          className="flex items-baseline justify-between"
          style={{ borderTop: "1px solid #eeece1", marginTop: 14, paddingTop: 14 }}
        >
          {preco() ? (
            <div
              className="font-serif font-medium leading-tight"
              style={{ fontSize: 22, color: "#2d2f28" }}
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
            style={{ color: "#9a8d3a" }}
          >
            Ver mais →
          </span>
        </div>
      </div>
    </Link>
  );
}
