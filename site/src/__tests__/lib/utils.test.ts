import { describe, it, expect } from "vitest";
import {
  formatarMoeda,
  labelTipoImovel,
  labelTipoNegocio,
  labelCondicao,
  labelMobiliado,
} from "@/lib/utils";

describe("formatarMoeda", () => {
  it("formata valor inteiro em BRL sem centavos", () => {
    expect(formatarMoeda(500000)).toBe("R$\u00a0500.000");
  });

  it("formata valor menor que 1000", () => {
    expect(formatarMoeda(800)).toBe("R$\u00a0800");
  });

  it("formata zero", () => {
    expect(formatarMoeda(0)).toBe("R$\u00a00");
  });
});

describe("labelTipoImovel", () => {
  it.each([
    ["casa",        "Casa"],
    ["apartamento", "Apartamento"],
    ["terreno",     "Terreno"],
    ["sala",        "Sala comercial"],
    ["galpao",      "Galpão"],
    ["loja",        "Loja"],
    ["cobertura",   "Cobertura"],
    ["kitnet",      "Kitnet / Studio"],
    ["outro",       "Outro"],
  ])('retorna "%s" para tipo "%s"', (tipo, esperado) => {
    expect(labelTipoImovel(tipo)).toBe(esperado);
  });

  it("retorna o próprio valor para tipo desconhecido", () => {
    expect(labelTipoImovel("desconhecido")).toBe("desconhecido");
  });
});

describe("labelTipoNegocio", () => {
  it.each([
    ["venda",   "Venda"],
    ["locacao", "Locação"],
    ["ambos",   "Venda e Locação"],
  ])('retorna "%s" para tipo "%s"', (tipo, esperado) => {
    expect(labelTipoNegocio(tipo)).toBe(esperado);
  });
});

describe("labelCondicao", () => {
  it.each([
    ["novo",          "Novo"],
    ["usado",         "Usado"],
    ["em_construcao", "Em construção"],
    ["na_planta",     "Na planta"],
  ])('retorna "%s" para condição "%s"', (condicao, esperado) => {
    expect(labelCondicao(condicao)).toBe(esperado);
  });
});

describe("labelMobiliado", () => {
  it.each([
    ["sim",            "Mobiliado"],
    ["nao",            "Sem mobília"],
    ["semi-mobiliado", "Semi-mobiliado"],
  ])('retorna "%s" para mobiliado "%s"', (mobiliado, esperado) => {
    expect(labelMobiliado(mobiliado)).toBe(esperado);
  });
});
