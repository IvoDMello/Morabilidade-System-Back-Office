import { describe, it, expect } from "vitest";
import { ordenarCaptacoes } from "./sort";
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
  it("manual preserva a referência original", () => {
    expect(ordenarCaptacoes(lista, "manual")).toBe(lista);
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
