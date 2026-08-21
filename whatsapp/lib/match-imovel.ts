import {
  TIPO_IMOVEL_LABELS,
  TIPO_NEGOCIO_LABELS,
  VALOR_MINIMO_OPORTUNIDADE,
} from "@/constants/oportunidades";
import type {
  CriterioMatch,
  ImovelDisponivel,
  PreferenciaBusca,
} from "@/types/oportunidade";

/**
 * Confronto entre o que o cliente procura e um imóvel do catálogo.
 *
 * ── Por que esta regra existe duas vezes ──────────────────────────────────
 * A regra oficial mora na API principal (`_imovel_casa_preferencia`, em
 * api/app/routers/oportunidades.py) e é o que o painel web mostra. O endpoint
 * que a expõe (`GET /clientes/{id}/matches`) exige JWT de usuário; o CRM fala
 * com o sistema por token de serviço, e não há endpoint interno equivalente.
 * Como o CRM lê as mesmas tabelas no mesmo Supabase, a alternativa era não ter
 * a aba. Então a regra é portada aqui, com um teste que trava cada ramo
 * (tests/match-imovel.test.ts) — se a API mudar o critério, o teste é o lugar
 * onde a divergência aparece.
 *
 * ── O que este módulo acrescenta ──────────────────────────────────────────
 * A API devolve só "casa ou não casa" e um score que, na prática, é a
 * especificidade da preferência: todos os imóveis de um mesmo cliente saem com
 * a mesma nota, então ela não ordena nada. Aqui o confronto é item a item, o
 * que dá duas coisas que a aba precisa: uma ordem (quantos critérios o imóvel
 * atende) e o "quase" — o imóvel que bate em tudo menos um ponto, que é
 * justamente sobre o que se abre uma conversa com o cliente.
 *
 * Puro de propósito: nada aqui toca banco, rede ou relógio.
 */

/** Minúsculas sem acento — a mesma comparação frouxa que a API faz (`_norm`). */
function norm(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function moedaCurta(valor: number): string {
  if (valor >= 1_000_000) {
    const m = valor / 1_000_000;
    return `R$ ${Number.isInteger(m) ? m : m.toFixed(1).replace(".", ",")}M`;
  }
  if (valor >= 1_000) return `R$ ${Math.round(valor / 1_000)}mil`;
  return `R$ ${valor}`;
}

/**
 * True quando o par (imóvel, preferência) é um negócio de LOCAÇÃO — é isso que
 * decide se o valor a comparar é o aluguel ou o preço de venda. Imóvel que
 * aceita os dois segue a intenção declarada pelo cliente.
 */
export function ehLocacao(imovel: ImovelDisponivel, pref: PreferenciaBusca): boolean {
  return (
    imovel.tipoNegocio === "locacao" ||
    (imovel.tipoNegocio === "ambos" && pref.tipoNegocio === "locacao")
  );
}

/** O valor que importa neste par: aluguel ou preço de venda. */
export function valorDoPar(
  imovel: ImovelDisponivel,
  pref: PreferenciaBusca,
): number | null {
  return ehLocacao(imovel, pref) ? imovel.valorLocacao : imovel.valorVenda;
}

/**
 * Imóvel abaixo do piso de oportunidade (ver VALOR_MINIMO_OPORTUNIDADE).
 *
 * Não é um critério do cliente — é um recorte da imobiliária — então fica fora
 * da contagem de critérios e some da lista em vez de aparecer como "fora".
 * Exceção herdada da API: quem procura locação não é barrado pelo preço de
 * venda de um imóvel que também aluga.
 */
export function foraDoRecorte(imovel: ImovelDisponivel, pref: PreferenciaBusca): boolean {
  const ehVenda =
    imovel.tipoNegocio === "venda" ||
    (imovel.tipoNegocio === "ambos" && pref.tipoNegocio !== "locacao");
  if (!ehVenda) return false;
  return imovel.valorVenda === null || imovel.valorVenda < VALOR_MINIMO_OPORTUNIDADE;
}

/**
 * Cada coisa que o cliente pediu, com o veredito do imóvel.
 *
 * `na` = o cliente não definiu esse critério, então ele não filtra nem conta.
 * Preferência sem nenhum critério definido casa com o catálogo inteiro — é o
 * comportamento da API, e a tela avisa que ali falta preencher.
 */
export function avaliarCriterios(
  imovel: ImovelDisponivel,
  pref: PreferenciaBusca,
): CriterioMatch[] {
  const criterios: CriterioMatch[] = [];

  // 1. Tipo de negócio — "ambos" na preferência não é um critério: aceita tudo.
  const negocioPedido =
    pref.tipoNegocio && pref.tipoNegocio !== "ambos" ? pref.tipoNegocio : null;
  criterios.push({
    chave: "negocio",
    rotulo: "Negócio",
    pedido: negocioPedido ? TIPO_NEGOCIO_LABELS[negocioPedido] ?? negocioPedido : "",
    status: !negocioPedido
      ? "na"
      : imovel.tipoNegocio === negocioPedido || imovel.tipoNegocio === "ambos"
        ? "ok"
        : "fora",
  });

  // 2. Tipo de imóvel — "apartamento térreo" é apartamento no andar 1.
  const tipoPedido = pref.tipoImovel || null;
  let tipoOk = false;
  if (tipoPedido === "apartamento_terreo") {
    tipoOk = imovel.tipoImovel === "apartamento" && imovel.andar === 1;
  } else if (tipoPedido) {
    tipoOk = imovel.tipoImovel === tipoPedido;
  }
  criterios.push({
    chave: "tipo",
    rotulo: "Tipo",
    pedido: tipoPedido ? TIPO_IMOVEL_LABELS[tipoPedido] ?? tipoPedido : "",
    status: !tipoPedido ? "na" : tipoOk ? "ok" : "fora",
  });

  // 3. Cidade — substring sem acento, que perdoa grafia ("Rio" casa "Rio de Janeiro").
  const cidadePedida = (pref.cidade ?? "").trim();
  criterios.push({
    chave: "cidade",
    rotulo: "Cidade",
    pedido: cidadePedida,
    status: !cidadePedida
      ? "na"
      : norm(imovel.cidade ?? "").includes(norm(cidadePedida))
        ? "ok"
        : "fora",
  });

  // 4. Bairros — basta um dos pedidos bater.
  const bairrosPedidos = (pref.bairros ?? []).map((b) => b.trim()).filter(Boolean);
  criterios.push({
    chave: "bairro",
    rotulo: "Bairro",
    pedido: bairrosPedidos.join(", "),
    status: !bairrosPedidos.length
      ? "na"
      : bairrosPedidos.some((b) => norm(imovel.bairro ?? "").includes(norm(b)))
        ? "ok"
        : "fora",
  });

  // 5. Dormitórios — 0 e null significam "tanto faz".
  const dormPedido = pref.dormitoriosMin && pref.dormitoriosMin > 0 ? pref.dormitoriosMin : null;
  criterios.push({
    chave: "dormitorios",
    rotulo: "Dorm.",
    pedido: dormPedido ? `${dormPedido}+` : "",
    status: !dormPedido
      ? "na"
      : (imovel.dormitorios ?? 0) >= dormPedido
        ? "ok"
        : "fora",
  });

  // 6. Vagas de garagem — mesma regra.
  const vagasPedidas =
    pref.vagasGaragemMin && pref.vagasGaragemMin > 0 ? pref.vagasGaragemMin : null;
  criterios.push({
    chave: "vagas",
    rotulo: "Vagas",
    pedido: vagasPedidas ? `${vagasPedidas}+` : "",
    status: !vagasPedidas
      ? "na"
      : (imovel.vagasGaragem ?? 0) >= vagasPedidas
        ? "ok"
        : "fora",
  });

  // 7. Faixa de valor — imóvel sem o valor do lado certo não atende.
  const temFaixa = pref.valorMin !== null || pref.valorMax !== null;
  const valor = valorDoPar(imovel, pref);
  let valorOk = valor !== null;
  if (valorOk && valor !== null) {
    if (pref.valorMin !== null && valor < pref.valorMin) valorOk = false;
    if (pref.valorMax !== null && valor > pref.valorMax) valorOk = false;
  }
  const partesFaixa: string[] = [];
  if (pref.valorMin !== null) partesFaixa.push(`de ${moedaCurta(pref.valorMin)}`);
  if (pref.valorMax !== null) partesFaixa.push(`até ${moedaCurta(pref.valorMax)}`);
  criterios.push({
    chave: "valor",
    rotulo: "Valor",
    pedido: partesFaixa.join(" "),
    status: !temFaixa ? "na" : valorOk ? "ok" : "fora",
  });

  return criterios;
}

export interface Veredito {
  criterios: CriterioMatch[];
  definidos: number;
  atendidos: number;
  /** Atende tudo que foi pedido — o mesmo conjunto que o painel web mostra. */
  compativel: boolean;
  /** Falta exatamente um critério. */
  quase: boolean;
}

/** Confronta um imóvel com uma preferência e resume o resultado. */
export function avaliarImovel(
  imovel: ImovelDisponivel,
  pref: PreferenciaBusca,
): Veredito {
  const criterios = avaliarCriterios(imovel, pref);
  const definidos = criterios.filter((c) => c.status !== "na").length;
  const atendidos = criterios.filter((c) => c.status === "ok").length;
  return {
    criterios,
    definidos,
    atendidos,
    compativel: atendidos === definidos,
    quase: definidos - atendidos === 1,
  };
}
