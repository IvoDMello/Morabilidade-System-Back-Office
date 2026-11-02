import type { Metadata } from "next";
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
  "Por quanto os imóveis do Rio foram vendidos, prédio a prédio, rua a rua e bairro a bairro. Valores declarados à Prefeitura no ITBI.";

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
  const local = resultado.tipo === "bairro" ? resultado.titulo : `${resultado.titulo} (${resultado.bairros[0] ?? "Rio"})`;
  const descricao = `${plural(resultado.total_historico, "venda registrada", "vendas registradas")} desde 2011 em ${local}. Valores declarados à Prefeitura no ITBI, com a mediana do m².`;
  const canonical = `${SITE_URL}${novaBusca({ q: params.q, cl: params.cl, numero: params.numero, bairro: params.bairro })}`;
  return {
    title: `${resultado.titulo}: vendas registradas na MoraMétrica`,
    description: descricao,
    alternates: { canonical },
    openGraph: { title: `${resultado.titulo} na MoraMétrica`, description: descricao, url: canonical },
  };
}

export default async function MoraMetricaPage({ searchParams }: Props) {
  const params = lerParametros(await searchParams);
  const [info, { resultado, erro }] = await Promise.all([getMoraMetricaInfo(), carregar(params)]);
  const endereco = resultado && TEM_RESUMO.includes(resultado.tipo) ? resultado.titulo : null;

  return (
    <>
      <Navbar marcaMobile />
      <ProvedorNavegacao>
        <div className="bg-[#585a4f]">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-8 pb-10 sm:pt-14 sm:pb-16 text-center">
            <p className="text-[11px] sm:text-xs font-bold tracking-[0.28em] uppercase text-[#d8cb6a]">
              Vendas registradas no Rio
            </p>
            <h1 className="font-serif text-white text-[42px] sm:text-6xl leading-none mt-3">MoraMétrica</h1>
            <p className="mt-4 text-[15px] sm:text-lg leading-relaxed text-[rgba(252,252,252,0.75)] max-w-2xl mx-auto">
              Por quanto os imóveis foram vendidos, prédio a prédio. São os valores declarados à
              Prefeitura no ITBI, não preços de anúncio.
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
