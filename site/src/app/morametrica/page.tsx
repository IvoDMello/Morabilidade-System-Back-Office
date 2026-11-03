import type { Metadata } from "next";
import { MoraMetricaTracker, type TipoBuscaMoraMetrica } from "@/components/analytics/MoraMetricaTracker";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BuscaMoraMetrica } from "@/components/morametrica/BuscaMoraMetrica";
import { ProvedorNavegacao } from "@/components/morametrica/Navegacao";
import { ResultadoMoraMetrica } from "@/components/morametrica/ResultadoMoraMetrica";
import {
  Apresentacao,
  ChamadaAvaliacao,
  ErroBusca,
  FonteLimitacoes,
} from "@/components/morametrica/Secoes";
import { buscarMoraMetrica, getMoraMetricaInfo, type RadarBusca } from "@/lib/api";
import {
  CAMINHO_MORAMETRICA,
  lerParametros,
  novaBusca,
  plural,
  temBusca,
  urlMoraMetrica,
  type ParametrosBusca,
} from "@/lib/morametrica";
import { SITE_URL } from "@/lib/site-url";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const DESCRICAO =
  "Valores reais de venda dos imóveis do Rio, unidade a unidade, declarados à Prefeitura para o cálculo do ITBI. Acesso gratuito.";

type Carga = { resultado: RadarBusca | null; erro: boolean };

async function carregar(params: ParametrosBusca): Promise<Carga> {
  if (!temBusca(params)) return { resultado: null, erro: false };
  try {
    return { resultado: await buscarMoraMetrica(params as Record<string, string>), erro: false };
  } catch {
    return { resultado: null, erro: true };
  }
}

const TEM_RESUMO = ["predio", "rua", "bairro"];

/** "Rua Bom Pastor, 521" ou, na busca por unidade, "Rua Bom Pastor, 521, BL 001 Apto 0801". */
function enderecoCompleto(resultado: RadarBusca): string {
  return [resultado.titulo, resultado.unidade].filter(Boolean).join(", ");
}

/** Como a busca entra na audiência: a de unidade é contada à parte da de prédio. */
function tipoDaBusca({ resultado, erro }: Carga): TipoBuscaMoraMetrica {
  if (erro || !resultado) return "erro";
  return resultado.tipo === "predio" && resultado.unidade ? "unidade" : resultado.tipo;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = lerParametros(await searchParams);
  const base: Metadata = {
    title: "MoraMétrica: por quanto os imóveis do Rio foram vendidos",
    description: DESCRICAO,
    alternates: { canonical: `${SITE_URL}${CAMINHO_MORAMETRICA}` },
    openGraph: { title: "MoraMétrica", description: DESCRICAO, url: `${SITE_URL}${CAMINHO_MORAMETRICA}` },
  };
  if (!temBusca(params)) return base;

  // O fetch é o mesmo da página (cache do Next), não custa outra ida à API.
  const { resultado } = await carregar(params);
  if (!resultado?.titulo || !TEM_RESUMO.includes(resultado.tipo)) {
    return { ...base, robots: { index: false } };
  }
  const nome = enderecoCompleto(resultado);
  const local = resultado.tipo === "bairro" ? nome : `${nome} (${resultado.bairros[0] ?? "Rio"})`;
  const descricao = `${plural(resultado.total_historico, "venda registrada", "vendas registradas")} desde 2011 em ${local}. Valores declarados à Prefeitura para o cálculo do ITBI, com a média do m².`;
  const canonical = `${SITE_URL}${novaBusca({ q: params.q, cl: params.cl, numero: params.numero, unidade: params.unidade, bairro: params.bairro })}`;
  return {
    title: `${nome}: vendas registradas na MoraMétrica`,
    description: descricao,
    alternates: { canonical },
    openGraph: { title: `${nome} na MoraMétrica`, description: descricao, url: canonical },
  };
}

export default async function MoraMetricaPage({ searchParams }: Props) {
  const params = lerParametros(await searchParams);
  const [info, carga] = await Promise.all([getMoraMetricaInfo(), carregar(params)]);
  const { resultado, erro } = carga;
  const endereco = resultado && TEM_RESUMO.includes(resultado.tipo) ? enderecoCompleto(resultado) : null;

  return (
    <>
      {temBusca(params) && (
        <MoraMetricaTracker
          busca={novaBusca({ q: params.q, cl: params.cl, numero: params.numero, unidade: params.unidade, bairro: params.bairro })}
          tipo={tipoDaBusca(carga)}
        />
      )}
      <Navbar marcaMobile />
      <ProvedorNavegacao>
        <div className="bg-[#585a4f]">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-8 pb-10 sm:pt-14 sm:pb-16 text-center">
            <p className="text-[11px] sm:text-xs font-bold tracking-[0.28em] uppercase text-[#d8cb6a]">
              Vendas registradas no Rio
            </p>
            <h1 className="font-serif text-white text-[42px] sm:text-6xl leading-none mt-3">MoraMétrica</h1>
            <p className="mt-4 text-[15px] sm:text-lg leading-relaxed text-[rgba(252,252,252,0.75)] max-w-2xl mx-auto">
              Valores reais de venda, unidade a unidade. Dados efetivamente declarados à Prefeitura
              para o cálculo do ITBI, com{" "}
              <em className="text-[#e8dea0]">acesso 100% gratuito para você.</em>
            </p>
            <div className="mt-7 sm:mt-9">
              <BuscaMoraMetrica valorInicial={params.q ?? ""} />
            </div>
          </div>
        </div>

        <main className="bg-[#f7f6f2]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-14">
            {erro ? (
              <ErroBusca href={urlMoraMetrica(params)} />
            ) : resultado ? (
              <ResultadoMoraMetrica dados={resultado} params={params} />
            ) : (
              <Apresentacao />
            )}
            <ChamadaAvaliacao endereco={endereco} />
            <FonteLimitacoes info={info} />
          </div>
        </main>
      </ProvedorNavegacao>
      <Footer />
    </>
  );
}
