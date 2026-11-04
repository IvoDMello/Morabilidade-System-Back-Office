import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BuscaMoraMetrica } from "@/components/morametrica/BuscaMoraMetrica";
import { ProvedorNavegacao } from "@/components/morametrica/Navegacao";
import { CAMINHO_MORAMETRICA } from "@/lib/morametrica";

/** Atalho da MoraMétrica na home: a busca começa aqui e o resultado abre na página da ferramenta. */
export function ChamadaMoraMetrica() {
  return (
    <div className="rounded-3xl bg-[#585a4f] px-5 py-10 sm:px-12 sm:py-14 text-center">
      <p className="text-[11px] font-bold tracking-[0.22em] uppercase text-[#d8cb6a]">
        MoraMétrica
      </p>
      <h2 className="font-serif text-white text-[28px] sm:text-[40px] leading-tight mt-3">
        Por quanto os imóveis do Rio foram vendidos
      </h2>
      <p className="mt-3 text-[15px] sm:text-base leading-relaxed text-[rgba(252,252,252,0.75)] max-w-xl mx-auto">
        Valores reais de venda, unidade a unidade, declarados à Prefeitura para o cálculo do ITBI.
        Busque um prédio, uma rua ou um bairro.
      </p>
      <div className="mt-7">
        <ProvedorNavegacao manterRolagem={false}>
          <BuscaMoraMetrica />
        </ProvedorNavegacao>
      </div>
      <Link
        href={CAMINHO_MORAMETRICA}
        className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold text-[rgba(252,252,252,0.8)] hover:text-white transition"
      >
        Conhecer a MoraMétrica <ArrowRight className="w-4 h-4" aria-hidden />
      </Link>
    </div>
  );
}
