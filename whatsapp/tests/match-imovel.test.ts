import { describe, expect, it } from "vitest";
import { avaliarImovel, ehLocacao, foraDoRecorte, valorDoPar } from "@/lib/match-imovel";
import { ranquearImoveis, calcularJanela } from "@/services/oportunidades.service";
import type { ImovelDisponivel, PreferenciaBusca } from "@/types/oportunidade";

/**
 * A regra de compatibilidade é uma cópia da que roda na API principal
 * (`_imovel_casa_preferencia`, api/app/routers/oportunidades.py) — ver o
 * cabeçalho de lib/match-imovel.ts para o porquê. Estes testes existem para
 * que a divergência apareça AQUI, e não numa mensagem enviada ao cliente
 * errado: cada `it` trava um ramo específico da regra original.
 */

function imovel(over: Partial<ImovelDisponivel> = {}): ImovelDisponivel {
  return {
    id: "i1",
    codigo: "MB-00001",
    titulo: "Apartamento",
    cidade: "Rio de Janeiro",
    bairro: "Ipanema",
    tipoImovel: "apartamento",
    tipoNegocio: "venda",
    andar: 5,
    valorVenda: 2_500_000,
    valorLocacao: null,
    dormitorios: 3,
    vagasGaragem: 2,
    fotoCapa: null,
    ...over,
  };
}

function pref(over: Partial<PreferenciaBusca> = {}): PreferenciaBusca {
  return {
    clienteId: "cli-1",
    tipoNegocio: null,
    tipoImovel: null,
    cidade: null,
    bairros: [],
    valorMin: null,
    valorMax: null,
    dormitoriosMin: null,
    vagasGaragemMin: null,
    observacoes: null,
    origem: "manual",
    atualizadaEm: null,
    ...over,
  };
}

describe("critérios de compatibilidade", () => {
  it("preferência vazia não filtra nada — e não conta critério nenhum", () => {
    const veredito = avaliarImovel(imovel(), pref());
    expect(veredito.definidos).toBe(0);
    expect(veredito.compativel).toBe(true);
  });

  it("tipo de negócio: imóvel 'ambos' serve para quem quer venda ou locação", () => {
    const p = pref({ tipoNegocio: "locacao" });
    expect(avaliarImovel(imovel({ tipoNegocio: "ambos" }), p).compativel).toBe(true);
    expect(avaliarImovel(imovel({ tipoNegocio: "venda" }), p).compativel).toBe(false);
  });

  it("tipo de negócio 'ambos' na preferência aceita tudo e não vira critério", () => {
    const veredito = avaliarImovel(imovel({ tipoNegocio: "locacao" }), pref({ tipoNegocio: "ambos" }));
    expect(veredito.definidos).toBe(0);
    expect(veredito.compativel).toBe(true);
  });

  it("'apartamento térreo' é apartamento no andar 1, não um tipo de imóvel", () => {
    const p = pref({ tipoImovel: "apartamento_terreo" });
    expect(avaliarImovel(imovel({ tipoImovel: "apartamento", andar: 1 }), p).compativel).toBe(true);
    expect(avaliarImovel(imovel({ tipoImovel: "apartamento", andar: 4 }), p).compativel).toBe(false);
    expect(avaliarImovel(imovel({ tipoImovel: "casa", andar: 1 }), p).compativel).toBe(false);
  });

  it("cidade e bairro comparam sem acento e por pedaço — grafia não pode derrubar match", () => {
    expect(avaliarImovel(imovel(), pref({ cidade: "rio" })).compativel).toBe(true);
    expect(
      avaliarImovel(imovel({ bairro: "Jardim Botânico" }), pref({ bairros: ["jardim botanico"] }))
        .compativel,
    ).toBe(true);
  });

  it("basta um bairro da lista bater", () => {
    const p = pref({ bairros: ["Leblon", "Ipanema"] });
    expect(avaliarImovel(imovel({ bairro: "Ipanema" }), p).compativel).toBe(true);
    expect(avaliarImovel(imovel({ bairro: "Botafogo" }), p).compativel).toBe(false);
  });

  it("dormitórios e vagas: 0 significa 'tanto faz', não 'exatamente zero'", () => {
    const p = pref({ dormitoriosMin: 0, vagasGaragemMin: 0 });
    const veredito = avaliarImovel(imovel({ dormitorios: null, vagasGaragem: null }), p);
    expect(veredito.definidos).toBe(0);
    expect(veredito.compativel).toBe(true);
  });

  it("imóvel sem o dado do requisito não atende — ausência não é aprovação", () => {
    const veredito = avaliarImovel(imovel({ dormitorios: null }), pref({ dormitoriosMin: 2 }));
    expect(veredito.compativel).toBe(false);
  });

  it("a faixa de valor usa o aluguel quando o par é de locação", () => {
    const imovelAmbos = imovel({ tipoNegocio: "ambos", valorVenda: 3_000_000, valorLocacao: 9_000 });
    const p = pref({ tipoNegocio: "locacao", valorMax: 10_000 });
    expect(ehLocacao(imovelAmbos, p)).toBe(true);
    expect(valorDoPar(imovelAmbos, p)).toBe(9_000);
    expect(avaliarImovel(imovelAmbos, p).compativel).toBe(true);
  });

  it("conta como 'quase' quando falta exatamente um critério", () => {
    const p = pref({ tipoImovel: "apartamento", bairros: ["Ipanema"], vagasGaragemMin: 2 });
    const veredito = avaliarImovel(imovel({ vagasGaragem: 1 }), p);
    expect(veredito.compativel).toBe(false);
    expect(veredito.quase).toBe(true);
    expect(veredito.criterios.find((c) => c.chave === "vagas")?.status).toBe("fora");
  });
});

describe("piso de R$ 2M das oportunidades", () => {
  it("imóvel de venda abaixo do piso fica de fora", () => {
    expect(foraDoRecorte(imovel({ valorVenda: 1_500_000 }), pref())).toBe(true);
    expect(foraDoRecorte(imovel({ valorVenda: 2_500_000 }), pref())).toBe(false);
  });

  it("não barra quem procura locação num imóvel que também aluga", () => {
    const imovelAmbos = imovel({ tipoNegocio: "ambos", valorVenda: 900_000, valorLocacao: 5_000 });
    expect(foraDoRecorte(imovelAmbos, pref({ tipoNegocio: "locacao" }))).toBe(false);
    expect(foraDoRecorte(imovelAmbos, pref({ tipoNegocio: "venda" }))).toBe(true);
  });

  it("some da lista em vez de virar um critério reprovado que ninguém pediu", () => {
    const lista = ranquearImoveis([imovel({ valorVenda: 900_000 })], pref());
    expect(lista).toEqual([]);
  });
});

describe("ordenação da lista", () => {
  const p = pref({ tipoImovel: "apartamento", bairros: ["Ipanema"], vagasGaragemMin: 2 });

  it("compatível vem antes de 'quase'", () => {
    const lista = ranquearImoveis(
      [
        imovel({ id: "quase", codigo: "MB-Q", vagasGaragem: 1 }),
        imovel({ id: "cheio", codigo: "MB-C", vagasGaragem: 2 }),
      ],
      p,
    );
    expect(lista.map((i) => i.id)).toEqual(["cheio", "quase"]);
  });

  it("no empate, o mais barato primeiro", () => {
    const lista = ranquearImoveis(
      [
        imovel({ id: "caro", codigo: "MB-1", valorVenda: 5_000_000 }),
        imovel({ id: "barato", codigo: "MB-2", valorVenda: 2_100_000 }),
      ],
      p,
    );
    expect(lista.map((i) => i.id)).toEqual(["barato", "caro"]);
  });

  it("marca como já enviado o que o contato já tem vinculado, sem depender de caixa", () => {
    const [primeiro] = ranquearImoveis([imovel({ codigo: "MB-00033" })], pref(), ["mb-00033"]);
    expect(primeiro.jaEnviado).toBe(true);
  });
});

describe("janela de 24h", () => {
  const agora = new Date("2026-08-21T12:00:00Z");

  it("aberta quando o cliente escreveu há menos de 24h", () => {
    expect(calcularJanela("2026-08-21T02:00:00Z", agora).aberta).toBe(true);
  });

  it("fechada depois de 24h", () => {
    expect(calcularJanela("2026-08-19T12:00:00Z", agora).aberta).toBe(false);
  });

  it("contato que nunca escreveu está fechado, sem data de fechamento", () => {
    expect(calcularJanela(null, agora)).toEqual({ aberta: false, fechaEm: null });
  });
});
