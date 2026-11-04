import { Building2, Map as MapaIcon, MapPin, MessageCircle, RotateCcw } from "lucide-react";
import type { RadarInfo } from "@/lib/api";
import {
  BAIRROS_ZONA_SUL,
  formatarInteiro,
  formatarMesExtenso,
  linkWhatsAppAvaliacao,
  novaBusca,
} from "@/lib/morametrica";
import { LinkBusca } from "./Navegacao";

const FONTE_URL =
  "https://fazenda.prefeitura.rio/itbi-valores-medios-por-m2-de-transacoes-imobiliarias-por-trecho-de-logradouro/";

/** Antes da primeira busca: como usar e atalhos para a Zona Sul. */
export function Apresentacao() {
  const formas = [
    {
      Icone: Building2,
      titulo: "Um prédio",
      texto: "Rua e número mostram cada venda registrada, com mês, unidade, área e valor declarado.",
      exemplo: "Vieira Souto 510",
    },
    {
      Icone: MapPin,
      titulo: "Uma rua",
      texto: "Sem o número, a rua aparece agrupada por prédio, com a média do m² de cada um.",
      exemplo: "Rua Farme de Amoedo",
    },
    {
      Icone: MapaIcon,
      titulo: "Um bairro",
      texto: "O resumo traz a média do m² por tipologia e as ruas mais negociadas.",
      exemplo: "Ipanema",
    },
  ];

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="grid gap-4 md:grid-cols-3">
        {formas.map(({ Icone, titulo, texto, exemplo }) => (
          <div key={titulo} className="bg-white rounded-2xl border border-[#e4e1d6] shadow-card p-5 sm:p-6">
            <Icone className="w-5 h-5 text-[#9a8d3a]" aria-hidden />
            <h2 className="font-serif text-xl text-[#2d2f28] mt-3">{titulo}</h2>
            <p className="text-sm text-[#7a7c72] mt-1.5 leading-relaxed">{texto}</p>
            <LinkBusca
              href={novaBusca({ q: exemplo })}
              className="inline-flex mt-4 text-sm font-semibold text-[#585a4f] hover:underline"
            >
              Ver {exemplo}
            </LinkBusca>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9a8d3a]">Zona Sul</h2>
        <div className="flex flex-wrap gap-2 mt-3">
          {BAIRROS_ZONA_SUL.map((bairro) => (
            <LinkBusca
              key={bairro}
              href={novaBusca({ q: bairro })}
              className="rounded-full border border-[#e4e1d6] bg-white px-3.5 py-1.5 text-sm text-[#2d2f28] hover:border-[#585a4f] transition"
            >
              {bairro}
            </LinkBusca>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChamadaAvaliacao() {
  const numero = process.env.NEXT_PUBLIC_WHATSAPP ?? "";
  return (
    <div className="rounded-2xl bg-[#3e4037] px-5 py-7 sm:px-10 sm:py-9 flex flex-col md:flex-row md:items-center gap-5 md:gap-10">
      <div className="flex-1">
        <h2 className="font-serif text-2xl sm:text-[28px] leading-tight text-white">
          Anuncie seu imóvel
        </h2>
        <p className="text-sm sm:text-base text-[rgba(252,252,252,0.7)] mt-2 leading-relaxed max-w-xl">
          Precificação adequada é uma das receitas de sucesso para uma venda rápida e justa. Se
          estiver vendendo seu imóvel, fale com a Morabilidade.
        </p>
      </div>
      <a
        href={linkWhatsAppAvaliacao(numero)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d8cb6a] hover:opacity-90 text-[#3e4037] font-bold px-6 py-3.5 text-[15px] transition self-start md:self-auto whitespace-nowrap"
      >
        <MessageCircle className="w-5 h-5" aria-hidden />
        Falar pelo WhatsApp
      </a>
    </div>
  );
}

export function FonteLimitacoes({ info }: { info: RadarInfo | null }) {
  return (
    <aside className="border-t border-[#e4e1d6] pt-7 text-sm text-[#7a7c72] leading-relaxed">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9a8d3a]">Sobre os dados</h2>
      <p className="mt-3">
        Fonte:{" "}
        <a href={FONTE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#2d2f28]">
          base de transações de ITBI da Secretaria Municipal de Fazenda do Rio de Janeiro
        </a>
        {info?.dados_ate && <>, com dados até {formatarMesExtenso(info.dados_ate)}</>}
        {info && info.transacoes > 0 && <> ({formatarInteiro(info.transacoes)} vendas desde 2011)</>}.
        Atualizada todo mês, conforme a Prefeitura publica.
      </p>
      <ul className="mt-3 space-y-1.5 list-disc pl-5">
        <li>O valor é o declarado à Prefeitura no ITBI. Não é avaliação nem preço de anúncio.</li>
        <li>A área é a do cadastro da Prefeitura e pode ser diferente da área útil de um anúncio.</li>
        <li>A Prefeitura informa só o mês e o ano de cada venda.</li>
        <li>
          Entram só transmissões pagas, como compra e venda e permuta. Doações e heranças pagam outro
          imposto (ITCMD, estadual) e não aparecem na MoraMétrica: como não há negociação de preço
          entre as partes, não servem de referência de valor para o imóvel.
        </li>
        <li>
          Os resumos usam a média simples das vendas do período. Vendas de parte do imóvel e
          frações de terreno em lançamentos ficam fora da média do m².
        </li>
        <li>Unidades, áreas e valores aparecem como constam na base pública da Prefeitura.</li>
      </ul>
    </aside>
  );
}

export function ErroBusca({ href }: { href: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e4e1d6] shadow-card p-6 sm:p-8 text-center">
      <p className="font-serif text-2xl text-[#2d2f28]">Não conseguimos consultar a base agora</p>
      <p className="text-sm text-[#7a7c72] mt-2">Tente de novo em alguns instantes.</p>
      <a
        href={href}
        className="inline-flex items-center gap-2 mt-5 rounded-lg bg-[#585a4f] hover:bg-[#4a4d43] text-white text-sm font-semibold px-4 py-2.5"
      >
        <RotateCcw className="w-4 h-4" aria-hidden />
        Tentar de novo
      </a>
    </div>
  );
}
