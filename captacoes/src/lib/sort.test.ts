import { describe, it, expect } from "vitest";
import { ordenarCaptacoes, ordenarPorSequencia, priorizarRevisaoGaveta } from "./sort";
import type { Captacao } from "@/types";

function card(p: Partial<Captacao>): Captacao {
  return {
    id: Math.random().toString(36),
    endereco: "",
    status: "aguardando_informacoes",
    ordem: 0,
    ...p,
  } as Captacao;
}

const dia = (n: number) => new Date(2024, 0, n).toISOString();

const lista = [
  card({ id: "a", criado_em: dia(1), atualizado_em: dia(10), valor_venda: 300 }),
  card({ id: "b", criado_em: dia(3), atualizado_em: dia(5), valor_venda: 100 }),
  card({ id: "c", criado_em: dia(2), atualizado_em: dia(8), valor_venda: null }),
];

describe("ordenarCaptacoes", () => {
  it("sequência sem posições por lista cai na ordem do cartão", () => {
    expect(ordenarCaptacoes(lista, "sequencia").map((c) => c.id)).toEqual(lista.map((c) => c.id));
  });
  it("recentes ordena por criado_em desc", () => {
    expect(ordenarCaptacoes(lista, "recentes").map((c) => c.id)).toEqual(["b", "c", "a"]);
  });
  it("antigas ordena por criado_em asc", () => {
    expect(ordenarCaptacoes(lista, "antigas").map((c) => c.id)).toEqual(["a", "c", "b"]);
  });
  it("valor_desc ordena por valor com nulos no fim", () => {
    expect(ordenarCaptacoes(lista, "valor_desc").map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
  it("valor_asc ordena crescente com nulos no fim", () => {
    expect(ordenarCaptacoes(lista, "valor_asc").map((c) => c.id)).toEqual(["b", "a", "c"]);
  });
  it("paradas coloca a atualização mais antiga primeiro", () => {
    expect(ordenarCaptacoes(lista, "paradas").map((c) => c.id)).toEqual(["b", "c", "a"]);
  });
  it("não muta a lista original", () => {
    const orig = lista.map((c) => c.id);
    ordenarCaptacoes(lista, "valor_desc");
    expect(lista.map((c) => c.id)).toEqual(orig);
  });
});

describe("priorizarRevisaoGaveta", () => {
  it("ordena a gaveta por revisão crescente, sem data no fim", () => {
    const cards = [
      card({ id: "a", status: "gaveta", gaveta_revisao_em: null }),
      card({ id: "b", status: "gaveta", gaveta_revisao_em: "2099-01-01" }),
      card({ id: "c", status: "gaveta", gaveta_revisao_em: "2020-01-01" }),
    ];
    expect(priorizarRevisaoGaveta(cards).map((c) => c.id)).toEqual(["c", "b", "a"]);
  });

  it("não move cards de outras colunas", () => {
    const cards = [
      card({ id: "x", status: "novas" }),
      card({ id: "a", status: "gaveta", gaveta_revisao_em: "2099-01-01" }),
      card({ id: "y", status: "em_decisao" }),
      card({ id: "b", status: "gaveta", gaveta_revisao_em: "2020-01-01" }),
    ];
    expect(priorizarRevisaoGaveta(cards).map((c) => c.id)).toEqual(["x", "b", "y", "a"]);
  });

  it("lista com menos de dois cards de gaveta volta intacta", () => {
    const cards = [card({ id: "x", status: "novas" }), card({ id: "a", status: "gaveta" })];
    expect(priorizarRevisaoGaveta(cards)).toBe(cards);
  });
});

describe("ordenarPorSequencia", () => {
  const fila = [
    card({ id: "x", ordem: 300 }),
    card({ id: "y", ordem: 100 }),
    card({ id: "z", ordem: 200 }),
  ];

  it("sem mapa, usa a ordem geral do cartão", () => {
    expect(ordenarPorSequencia(fila).map((c) => c.id)).toEqual(["y", "z", "x"]);
  });

  it("com mapa, usa a sequência daquela lista", () => {
    const naLista = new Map([
      ["x", 10],
      ["y", 30],
      ["z", 20],
    ]);
    expect(ordenarPorSequencia(fila, naLista).map((c) => c.id)).toEqual(["x", "z", "y"]);
  });

  it("quem não está na lista vai para o fim, nunca para o topo", () => {
    const naLista = new Map([
      ["z", 20],
      ["x", 10],
    ]);
    expect(ordenarPorSequencia(fila, naLista).map((c) => c.id)).toEqual(["x", "z", "y"]);
  });

  it("não muta o array recebido", () => {
    const antes = fila.map((c) => c.id);
    ordenarPorSequencia(fila);
    expect(fila.map((c) => c.id)).toEqual(antes);
  });
});
