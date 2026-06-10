import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft, BedDouble, Bath, Car, Ruler, MapPin,
  Tag, Building, Calendar, MessageCircle, Instagram,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Galeria } from "@/components/imoveis/Galeria";
import { WhatsAppButtonImovel } from "@/components/imoveis/WhatsAppButtonImovel";
import { FavoritoButton } from "@/components/imoveis/FavoritoButton";
import { CompartilharButton } from "@/components/imoveis/CompartilharButton";
import MapaRegiaoClient from "@/components/imoveis/MapaRegiaoClient";
import { getImovel } from "@/lib/api";
import { geocodificarEndereco } from "@/lib/geocoding";
import {
  formatarMoeda, labelTipoImovel, labelTipoNegocio,
  labelCondicao, labelMobiliado,
} from "@/lib/utils";

interface Props {
  params: Promise<{ codigo: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://morabilidade.com.br";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  const imovel = await getImovel(codigo).catch(() => null);
  if (!imovel) return { title: "Imóvel não encontrado" };

  const titulo =
    imovel.titulo?.trim() ||
    `${labelTipoImovel(imovel.tipo_imovel)} em ${imovel.bairro}, ${imovel.cidade}`;
  const descricao =
    imovel.descricao?.slice(0, 160) ??
    `${titulo} — ${labelTipoNegocio(imovel.tipo_negocio)} pela Morabilidade.`;
  const imagemUrl = imovel.fotos[0]?.url;
  const pageUrl = `${SITE_URL}/imoveis/${imovel.codigo}`;

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      url: pageUrl,
      siteName: "Morabilidade",
      type: "website",
      locale: "pt_BR",
      images: imagemUrl
        ? [{ url: imagemUrl, width: 1200, height: 630, alt: titulo }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descricao,
      images: imagemUrl ? [imagemUrl] : [],
    },
  };
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-slate-50 last:border-0 gap-4">
      <span className="text-sm text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}

export default async function DetalheImovelPage({ params }: Props) {
  const { codigo } = await params;
  const imovel = await getImovel(codigo).catch(() => null);
  if (!imovel) notFound();

  const precoVenda = imovel.valor_venda ? formatarMoeda(imovel.valor_venda) : null;
  const precoLocacao = imovel.valor_locacao ? `${formatarMoeda(imovel.valor_locacao)}/mês` : null;

  const regiao = [imovel.bairro, imovel.cidade].filter(Boolean).join(", ");
  const mapQuery = encodeURIComponent(regiao);
  const coordenadas = await geocodificarEndereco(
    imovel.logradouro,
    imovel.bairro,
    imovel.cidade,
  );

  const tituloPublico =
    imovel.titulo?.trim() ||
    `${labelTipoImovel(imovel.tipo_imovel)} em ${imovel.bairro}, ${imovel.cidade}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: tituloPublico,
    description: imovel.descricao ?? tituloPublico,
    url: `${SITE_URL}/imoveis/${imovel.codigo}`,
    image: imovel.fotos.map((f) => f.url),
    address: {
      "@type": "PostalAddress",
      addressLocality: imovel.cidade,
      addressRegion: "RJ",
      addressCountry: "BR",
    },
    ...(imovel.valor_venda && {
      offers: {
        "@type": "Offer",
        price: imovel.valor_venda,
        priceCurrency: "BRL",
        availability: "https://schema.org/InStock",
      },
    }),
    numberOfRooms: imovel.dormitorios,
    floorSize: imovel.area_util
      ? { "@type": "QuantitativeValue", value: imovel.area_util, unitCode: "MTK" }
      : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, "\\u003c")
            .replace(/>/g, "\\u003e")
            .replace(/&/g, "\\u0026"),
        }}
      />
      <Navbar />
      <WhatsAppButtonImovel codigo={imovel.codigo} titulo={tituloPublico} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <Link href="/imoveis" className="flex items-center gap-1 hover:text-slate-600 transition">
            <ArrowLeft className="w-4 h-4" /> Imóveis
          </Link>
          <span>/</span>
          <span className="text-slate-600 font-mono">{imovel.codigo}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:items-start">

          {/* ── Galeria + cabeçalho (col. esquerda, topo) ── */}
          {/* order-1: no mobile vem primeiro; a sidebar (preço + CTAs) aparece logo a seguir. */}
          <div className="order-1 lg:col-span-2 lg:row-start-1 space-y-6">

            {/* Galeria */}
            <Galeria fotos={imovel.fotos} />

            {/* Cabeçalho */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className="px-3 py-1 text-xs font-semibold rounded-full text-white"
                  style={{ backgroundColor: "#585a4f" }}
                >
                  {labelTipoNegocio(imovel.tipo_negocio)}
                </span>
                {imovel.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="px-3 py-1 text-xs font-medium rounded-full text-white"
                    style={{ backgroundColor: tag.cor ?? "#6b7280" }}
                  >
                    {tag.nome}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                {tituloPublico}
              </h1>
              <p className="text-slate-500 mt-1 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                {regiao}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <FavoritoButton codigo={imovel.codigo} variant="pill" />
                <CompartilharButton codigo={imovel.codigo} titulo={tituloPublico} />
              </div>
            </div>
          </div>

          {/* ── Resto da coluna esquerda: descrição, ficha e mapa ── */}
          {/* order-3: no mobile vem depois da sidebar (preço + CTAs + características). */}
          <div className="order-3 lg:col-span-2 lg:row-start-2 space-y-8">

            {/* Descrição */}
            {imovel.descricao && (
              <div>
                <h2 className="font-semibold text-slate-800 mb-2">Descrição</h2>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                  {imovel.descricao}
                </p>
              </div>
            )}

            {/* Ficha técnica */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Building className="w-4 h-4" style={{ color: "#585a4f" }} />
                Ficha do imóvel
              </h2>
              <InfoRow label="Código" value={<span className="font-mono">{imovel.codigo}</span>} />
              <InfoRow label="Tipo" value={labelTipoImovel(imovel.tipo_imovel)} />
              <InfoRow label="Condição" value={labelCondicao(imovel.condicao)} />
              {imovel.mobiliado && (
                <InfoRow label="Mobiliado" value={labelMobiliado(imovel.mobiliado)} />
              )}
              {imovel.andar != null && (
                <InfoRow label="Andar" value={`${imovel.andar}º`} />
              )}
              {imovel.iptu_mensal != null && (
                <InfoRow label="IPTU mensal" value={formatarMoeda(imovel.iptu_mensal)} />
              )}
              {imovel.condominio_mensal != null && (
                <InfoRow label="Condomínio" value={formatarMoeda(imovel.condominio_mensal)} />
              )}
            </div>


            {/* Localização */}
            <div>
              <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: "#585a4f" }} />
                Região
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                {regiao}
                <span className="block text-xs text-slate-400 mt-1">
                  O mapa mostra apenas a região aproximada. Endereço completo enviado ao confirmar o interesse.
                </span>
              </p>

              {/* Radar da região — círculo de ~300m sobre OpenStreetMap */}
              {/* `isolate` cria stacking context para conter o z-index alto das panes do Leaflet
                  (até 1000) e impedir que sobreponham a navbar sticky (z-50). */}
              <div className="relative isolate rounded-xl overflow-hidden border border-slate-100 shadow-sm mb-3 aspect-video">
                {coordenadas ? (
                  <MapaRegiaoClient lat={coordenadas.lat} lng={coordenadas.lng} />
                ) : (
                  <iframe
                    title={`Mapa da região — ${regiao}`}
                    src={`https://maps.google.com/maps?q=${mapQuery}&output=embed&hl=pt-BR&z=14`}
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                )}
              </div>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium underline transition hover:opacity-80"
                style={{ color: "#585a4f" }}
              >
                Ver a região no Google Maps →
              </a>
            </div>
          </div>

          {/* ── Sidebar (preço + CTAs + características) ── */}
          {/* order-2: no mobile aparece logo após galeria+cabeçalho, antes da
              descrição. No desktop fica na 3ª coluna, sticky, abrangendo as duas
              linhas da coluna esquerda. */}
          <div
            className="order-2 space-y-4 lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:sticky lg:self-start"
            style={{ top: "clamp(96px, 12vw, 104px)" }}
          >

            {/* Card de preço */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs text-slate-400 font-mono mb-1">{imovel.codigo}</p>

              {precoVenda && (
                <div className="mb-2">
                  <p className="text-xs text-slate-400">Venda</p>
                  <p className="text-2xl font-bold" style={{ color: "#585a4f" }}>
                    {precoVenda}
                  </p>
                </div>
              )}
              {precoLocacao && (
                <div className="mb-4">
                  <p className="text-xs text-slate-400">Locação</p>
                  <p className="text-2xl font-bold" style={{ color: "#585a4f" }}>
                    {precoLocacao}
                  </p>
                </div>
              )}
              {!precoVenda && !precoLocacao && (
                <p className="text-slate-400 text-sm mb-4">Consulte o valor</p>
              )}

              {/* Botão primário — WhatsApp */}
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP ?? "5500000000000"}?text=${encodeURIComponent(`Olá! Tenho interesse no imóvel *${tituloPublico}* (código *${imovel.codigo}*). Pode me dar mais informações?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: "#25D366" }}
              >
                <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
              </a>

              {/* Vídeo do imóvel no Instagram */}
              {imovel.video_url && (
                <a
                  href={imovel.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #3e4037 0%, #585a4f 72%, #d8cb6a 100%)" }}
                >
                  <Instagram className="w-4 h-4" /> Ver vídeo no Instagram
                </a>
              )}

              <p className="text-xs text-slate-400 text-center mt-3">
                Resposta em até 24h úteis
              </p>
            </div>

            {/* Características rápidas */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-3 text-center text-xs">
                {imovel.dormitorios != null && (
                  <div className="bg-white rounded-lg p-3">
                    <BedDouble className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                    <p className="font-semibold text-slate-700">{imovel.dormitorios}</p>
                    <p className="text-slate-400">Dorms.</p>
                  </div>
                )}
                {imovel.suites != null && (
                  <div className="bg-white rounded-lg p-3">
                    <BedDouble className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                    <p className="font-semibold text-slate-700">{imovel.suites}</p>
                    <p className="text-slate-400">Suítes</p>
                  </div>
                )}
                {imovel.banheiros != null && (
                  <div className="bg-white rounded-lg p-3">
                    <Bath className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                    <p className="font-semibold text-slate-700">{imovel.banheiros}</p>
                    <p className="text-slate-400">Banheiros</p>
                  </div>
                )}
                {imovel.vagas_garagem != null && (
                  <div className="bg-white rounded-lg p-3">
                    <Car className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                    <p className="font-semibold text-slate-700">{imovel.vagas_garagem}</p>
                    <p className="text-slate-400">Vagas</p>
                  </div>
                )}
                {imovel.area_util != null && (
                  <div className="bg-white rounded-lg p-3">
                    <Ruler className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                    <p className="font-semibold text-slate-700">{imovel.area_util}</p>
                    <p className="text-slate-400">m² úteis</p>
                  </div>
                )}
                {imovel.area_total != null && (
                  <div className="bg-white rounded-lg p-3">
                    <Ruler className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                    <p className="font-semibold text-slate-700">{imovel.area_total}</p>
                    <p className="text-slate-400">m² total</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
