import type { Captacao, Etapa } from "@/types";
import { ETAPA_LABEL } from "@/types";
import { etapaDaCaptacao } from "./etapa";
import { filtrarCaptacoes } from "./filter";

/** Um bloco de resultados: as captações que casaram dentro de uma etapa. */
export interface GrupoBusca {
  etapa: Etapa;
  titulo: string;
  /** Rota da aba correspondente; `null` quando a etapa não tem aba própria. */
  href: string | null;
  itens: Captacao[];
}

/** Ordem das abas, para os resultados saírem na mesma sequência da TabBar. */
const ORDEM: { etapa: Etapa; href: string | null }[] = [
  { etapa: "decidir", href: "/decidir" },
  { etapa: "aprovada", href: "/aprovadas" },
  { etapa: "negativada", href: "/negativadas" },
  // Publicada não tem aba: mora no menu "⋯". Ainda assim entra na busca —
  // "onde foi parar aquele endereço?" costuma terminar justamente numa
  // captação que já saiu do fluxo.
  { etapa: "publicada", href: null },
];

/**
 * Busca em TODAS as captações do app, não só nas da aba aberta, e devolve os
 * achados agrupados por etapa.
 *
 * A busca por aba escondia o resultado de quem procurava um endereço sem
 * lembrar em que ponto do fluxo ele estava — que é justamente quando se
 * procura. O termo continua sendo o mesmo do cabeçalho (store `filtro`).
 *
 * `excluir` tira da resposta a etapa que a própria tela já está listando,
 * para o resultado não aparecer duas vezes na mesma rolagem.
 */
export function buscaGlobal(cards: Captacao[], termo: string, excluir?: Etapa): GrupoBusca[] {
  if (!termo.trim()) return [];

  const achados = filtrarCaptacoes(cards, termo);
  const porEtapa = new Map<Etapa, Captacao[]>();
  for (const c of achados) {
    const etapa = etapaDaCaptacao(c);
    if (etapa === excluir) continue;
    const atual = porEtapa.get(etapa);
    if (atual) atual.push(c);
    else porEtapa.set(etapa, [c]);
  }

  return ORDEM.filter(({ etapa }) => porEtapa.has(etapa)).map(({ etapa, href }) => ({
    etapa,
    href,
    titulo: ETAPA_LABEL[etapa],
    itens: porEtapa.get(etapa)!,
  }));
}

/** Quantas captações os grupos somam — alimenta o "N em outras abas". */
export function totalResultados(grupos: GrupoBusca[]): number {
  return grupos.reduce((n, g) => n + g.itens.length, 0);
}
