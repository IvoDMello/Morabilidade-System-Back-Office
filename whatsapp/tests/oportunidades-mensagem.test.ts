import { describe, expect, it } from "vitest";
import { montarRascunho, primeiroNome } from "@/features/oportunidades/lib/mensagem";
import { descreverPreferencia } from "@/features/oportunidades/lib/resumo-preferencia";
import type { ImovelCompativel, PreferenciaBusca } from "@/types/oportunidade";

function imovel(over: Partial<ImovelCompativel> = {}): ImovelCompativel {
  return {
    id: "i1",
    codigo: "MB-00033",
    titulo: "Cobertura em Ipanema",
    cidade: "Rio de Janeiro",
    bairro: "Ipanema",
    tipoImovel: "cobertura",
    tipoNegocio: "venda",
    andar: 8,
    valorVenda: 4_200_000,
    valorLocacao: null,
    dormitorios: 3,
    vagasGaragem: 2,
    fotoCapa: null,
    criterios: [],
    definidos: 0,
    atendidos: 0,
    compativel: true,
    quase: false,
    valor: 4_200_000,
    jaEnviado: false,
    ...over,
  };
}

/**
 * O rascunho é o que faz a aba valer a pena: sem ele, "saber quais imóveis
 * combinam" ainda custa abrir o catálogo, copiar código, procurar preço e
 * escrever tudo à mão para cada cliente.
 */
describe("rascunho da mensagem", () => {
  it("traz código, bairro, valor e link de cada imóvel escolhido", () => {
    const texto = montarRascunho({
      nomeContato: "Fernanda Lima",
      imoveis: [imovel()],
      siteUrl: "https://morabilidade.com",
    });

    expect(texto).toContain("Oi, Fernanda!");
    expect(texto).toContain("MB-00033");
    expect(texto).toContain("Ipanema");
    expect(texto).toContain("R$ 4.200.000");
    expect(texto).toContain("https://morabilidade.com/imoveis/MB-00033");
  });

  it("marca o valor de locação como mensal", () => {
    const texto = montarRascunho({
      nomeContato: "Ana",
      imoveis: [imovel({ tipoNegocio: "locacao", valor: 6_500, valorLocacao: 6_500 })],
      siteUrl: null,
    });
    expect(texto).toContain("/mês");
  });

  it("sem site configurado, o texto sai sem link em vez de sair quebrado", () => {
    const texto = montarRascunho({
      nomeContato: "Ana",
      imoveis: [imovel()],
      siteUrl: null,
    });
    expect(texto).not.toContain("http");
    expect(texto).toContain("MB-00033");
  });

  it("concorda o número no singular e no plural", () => {
    const um = montarRascunho({ nomeContato: "Ana", imoveis: [imovel()], siteUrl: null });
    expect(um).toContain("Separei um imóvel");

    const dois = montarRascunho({
      nomeContato: "Ana",
      imoveis: [imovel(), imovel({ id: "i2", codigo: "MB-00041" })],
      siteUrl: null,
    });
    expect(dois).toContain("Separei 2 imóveis");
  });

  it("sem imóvel escolhido não inventa mensagem", () => {
    expect(montarRascunho({ nomeContato: "Ana", imoveis: [], siteUrl: null })).toBe("");
  });

  it("usa só o primeiro nome, e não engasga com contato de exemplo", () => {
    expect(primeiroNome("Fernanda Lima")).toBe("Fernanda");
    expect(primeiroNome("Exemplo — Comprador")).toBe("Exemplo");
    expect(primeiroNome("   ")).toBe("");
  });
});

describe("resumo do perfil de busca", () => {
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

  it("mostra só o que foi preenchido", () => {
    const texto = descreverPreferencia(
      pref({ tipoImovel: "apartamento", bairros: ["Ipanema"], valorMax: 3_000_000, dormitoriosMin: 3 }),
    );
    expect(texto).toContain("Apartamento");
    expect(texto).toContain("Ipanema");
    expect(texto).toContain("até R$ 3M");
    expect(texto).toContain("3+ dorm.");
    expect(texto).not.toMatch(/vagas/i);
  });

  it("perfil sem nenhum critério diz o que isso significa, em vez de sair em branco", () => {
    expect(descreverPreferencia(pref())).toBe("qualquer imóvel disponível");
  });
});
