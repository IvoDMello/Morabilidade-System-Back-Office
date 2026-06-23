import { describe, it, expect } from "vitest";
import { filtrarCaptacoes, filtrarPorCriterios } from "./filter";
import { CRITERIOS_VAZIO, type Captacao } from "@/types";

function card(p: Partial<Captacao>): Captacao {
  return {
    id: Math.random().toString(36),
    endereco: "",
    status: "aguardando_informacoes",
    ordem: 0,
    ...p,
  } as Captacao;
}

const lista = [
  card({ endereco: "Rua das Flores, 100", proprietario_nome: "Maria" }),
  card({ endereco: "Av. Brasil, 200", whatsapp: "11988887777" }),
  card({ endereco: "Travessa X", observacoes: "imóvel com vista mar" }),
  card({ endereco: "Rua Y", tipo_portaria: "24 horas" }),
];

describe("filtrarCaptacoes", () => {
  it("termo vazio retorna tudo", () => {
    expect(filtrarCaptacoes(lista, "")).toHaveLength(4);
    expect(filtrarCaptacoes(lista, "   ")).toHaveLength(4);
  });
  it("filtra por endereço (case-insensitive)", () => {
    const r = filtrarCaptacoes(lista, "flores");
    expect(r).toHaveLength(1);
    expect(r[0].proprietario_nome).toBe("Maria");
  });
  it("filtra por proprietário", () => {
    expect(filtrarCaptacoes(lista, "maria")).toHaveLength(1);
  });
  it("filtra por whatsapp", () => {
    expect(filtrarCaptacoes(lista, "98888")).toHaveLength(1);
  });
  it("filtra por observações", () => {
    expect(filtrarCaptacoes(lista, "vista mar")).toHaveLength(1);
  });
  it("filtra por tipo de portaria", () => {
    expect(filtrarCaptacoes(lista, "24 horas")).toHaveLength(1);
  });
  it("sem correspondência retorna vazio", () => {
    expect(filtrarCaptacoes(lista, "inexistente")).toHaveLength(0);
  });
  it("ignora campos nulos sem quebrar", () => {
    expect(() => filtrarCaptacoes([card({ endereco: "Z" })], "z")).not.toThrow();
  });
});

const ontem = () => new Date(Date.now() - 5 * 86400000).toISOString();
const agora = () => new Date().toISOString();

const porValor = [
  card({ id: "barato", valor_venda: 100, quartos: 1 }),
  card({ id: "medio", valor_venda: 300, quartos: 3 }),
  card({ id: "caro", valor_venda: 500, quartos: 4 }),
  card({ id: "semvalor", valor_venda: null, quartos: null }),
];

describe("filtrarPorCriterios", () => {
  it("critérios vazios retornam tudo", () => {
    expect(filtrarPorCriterios(porValor, CRITERIOS_VAZIO)).toHaveLength(4);
  });
  it("valorMin descarta abaixo do mínimo e nulos", () => {
    const r = filtrarPorCriterios(porValor, { ...CRITERIOS_VAZIO, valorMin: 300 });
    expect(r.map((c) => c.id)).toEqual(["medio", "caro"]);
  });
  it("valorMax descarta acima do máximo e nulos", () => {
    const r = filtrarPorCriterios(porValor, { ...CRITERIOS_VAZIO, valorMax: 300 });
    expect(r.map((c) => c.id)).toEqual(["barato", "medio"]);
  });
  it("quartosMin descarta abaixo e nulos", () => {
    const r = filtrarPorCriterios(porValor, { ...CRITERIOS_VAZIO, quartosMin: 3 });
    expect(r.map((c) => c.id)).toEqual(["medio", "caro"]);
  });
  it("soParadas mantém só atualização antiga", () => {
    const lst = [card({ id: "velho", atualizado_em: ontem() }), card({ id: "novo", atualizado_em: agora() })];
    const r = filtrarPorCriterios(lst, { ...CRITERIOS_VAZIO, soParadas: true });
    expect(r.map((c) => c.id)).toEqual(["velho"]);
  });
});
