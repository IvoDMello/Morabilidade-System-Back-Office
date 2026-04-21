import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft, BedDouble, Bath, Car, Ruler, MapPin,
  Tag, Building, Calendar, Phone,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Galeria } from "@/components/imoveis/Galeria";
import { WhatsAppButtonImovel } from "@/components/imoveis/WhatsAppButtonImovel";
import { getImovel } from "@/lib/api";
import {
  formatarMoeda, labelTipoImovel, labelTipoNegocio,
  labelCondicao, labelMobiliado,
} from "@/lib/utils";

interface Props {
  params: Promise<{ codigo: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  const imovel = await getImovel(codigo).catch(() => null);
  if (!imovel) return { title: "Imóvel não encontrado" };

  const titulo = `${labelTipoImovel(imovel.tipo_imovel)} em ${imovel.bairro}, ${imovel.cidade}`;
  return {
    title: titulo,
    description: imovel.descricao?.slice(0, 160) ?? `${titulo} — ${labelTipoNegocio(imovel.tipo_negocio)}`,
    openGraph: {
      title: titulo,
      images: imovel.fotos[0] ? [{ url: imovel.fotos[0].url }] : [],
    },
  };
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
      {children}
    </span>
  );
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

  const endereco = [
    imovel.logradouro,
    imovel.numero ? `nº ${imovel.numero}` : null,
    imovel.complemento,
    imovel.bairro,
    imovel.cidade,
  ]
    .filter(Boolean)
    .join(", ");

  const mapQuery = encodeURIComponent(endereco);

  const tituloImovel = `${labelTipoImovel(imovel.tipo_imovel)} em ${imovel.bairro}, ${imovel.cidade}`;

  return (
    <>
      <Navbar />
      <WhatsAppButtonImovel codigo={imovel.codigo} titulo={tituloImovel} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <Link href="/imoveis" className="flex items-center gap-1 hover:text-slate-600 transition">
            <ArrowLeft className="w-4 h-4" /> Imóveis
          </Link>
          <span>/</span>
          <span className="text-slate-600 font-mono">{imovel.codigo}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Coluna principal ── */}
          <div className="lg:col-span-2 space-y-8">

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
                {labelTipoImovel(imovel.tipo_imovel)}
              </h1>
              <p className="text-slate-500 mt-1 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                {endereco}
              </p>
            </div>

            {/* Chips de características */}
            <div className="flex flex-wrap gap-2">
              {imovel.dormitorios != null && (
                <Chip><BedDouble className="w-3.5 h-3.5" /> {imovel.dormitorios} dorm.</Chip>
              )}
              {imovel.suites != null && (
                <Chip><BedDouble className="w-3.5 h-3.5" /> {imovel.suites} suítes</Chip>
              )}
              {imovel.banheiros != null && (
                <Chip><Bath className="w-3.5 h-3.5" /> {imovel.banheiros} banheiros</Chip>
              )}
              {imovel.vagas_garagem != null && (
                <Chip><Car className="w-3.5 h-3.5" /> {imovel.vagas_garagem} vagas</Chip>
              )}
              {imovel.area_util != null && (
                <Chip><Ruler className="w-3.5 h-3.5" /> {imovel.area_util} m² úteis</Chip>
              )}
              {imovel.area_total != null && (
                <Chip><Ruler className="w-3.5 h-3.5" /> {imovel.area_total} m² total</Chip>
              )}
            </div>

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
              <InfoRow
                label="Cadastrado em"
                value={new Date(imovel.created_at).toLocaleDateString("pt-BR")}
              />
            </div>

            {/* Vídeo */}
            {imovel.video_url && (
              <div>
                <h2 className="font-semibold text-slate-800 mb-3">Vídeo do imóvel</h2>
                <a
                  href={imovel.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline"
                  style={{ color: "#585a4f" }}
                >
                  Assistir ao vídeo →
                </a>
              </div>
            )}

            {/* Localização */}
            <div>
              <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: "#585a4f" }} />
                Localização
              </h2>
              <p className="text-sm text-slate-500 mb-3">{endereco}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium underline transition hover:opacity-80"
                style={{ color: "#585a4f" }}
              >
                Ver no Google Maps →
              </a>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4">

            {/* Card de preço */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 sticky top-20">
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

              <Link
                href={`/contato?imovel=${imovel.codigo}`}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: "#585a4f" }}
              >
                <Phone className="w-4 h-4" /> Tenho interesse
              </Link>

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
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
