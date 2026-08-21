import { TIPO_IMOVEL_LABELS, TIPO_NEGOCIO_LABELS } from "@/constants/oportunidades";
import type { PreferenciaBusca } from "@/types/oportunidade";

/** "R$ 3M" / "R$ 850mil" — valor curto, para caber numa linha de resumo. */
function moedaCurta(valor: number): string {
  if (valor >= 1_000_000) {
    const m = valor / 1_000_000;
    return `R$ ${Number.isInteger(m) ? m : m.toFixed(1).replace(".", ",")}M`;
  }
  if (valor >= 1_000) return `R$ ${Math.round(valor / 1_000)}mil`;
  return `R$ ${valor}`;
}

/**
 * O perfil de busca em uma linha, só com o que foi realmente preenchido.
 *
 * Campos vazios somem em vez de virar "Tanto faz": um resumo cheio de
 * "qualquer coisa" ocupa a linha inteira sem informar nada, e o que interessa
 * na lista é ver de relance o que aquele cliente pediu.
 */
export function descreverPreferencia(pref: PreferenciaBusca): string {
  const partes: string[] = [];

  if (pref.tipoImovel) partes.push(TIPO_IMOVEL_LABELS[pref.tipoImovel] ?? pref.tipoImovel);
  if (pref.tipoNegocio && pref.tipoNegocio !== "ambos") {
    partes.push(`para ${(TIPO_NEGOCIO_LABELS[pref.tipoNegocio] ?? pref.tipoNegocio).toLowerCase()}`);
  }

  const lugar = [pref.bairros.join(", "), pref.cidade].filter(Boolean).join(" — ");
  if (lugar) partes.push(lugar);

  if (pref.dormitoriosMin) partes.push(`${pref.dormitoriosMin}+ dorm.`);
  if (pref.vagasGaragemMin) partes.push(`${pref.vagasGaragemMin}+ vagas`);

  if (pref.valorMin !== null && pref.valorMax !== null) {
    partes.push(`${moedaCurta(pref.valorMin)} a ${moedaCurta(pref.valorMax)}`);
  } else if (pref.valorMax !== null) {
    partes.push(`até ${moedaCurta(pref.valorMax)}`);
  } else if (pref.valorMin !== null) {
    partes.push(`a partir de ${moedaCurta(pref.valorMin)}`);
  }

  // Perfil salvo sem nenhum critério casa com o catálogo inteiro — e é melhor
  // dizer isso do que devolver uma linha em branco que parece bug.
  return partes.length > 0 ? partes.join(" · ") : "qualquer imóvel disponível";
}
