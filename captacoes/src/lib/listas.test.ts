import { describe, it, expect } from "vitest";
import { COR_LISTA, captacoesDaLista, corDaLista, indexarListas, ordemNaLista, separarListas } from "./listas";
import type { CaptacaoLista, Lista } from "@/types";

function lista(p: Partial<Lista>): Lista {
  return {
    id: "l1",
    nome: "Lista",
    cor: "cinza",
    permanente: false,
    ordem: 0,
    criado_por: null,
    criado_em: "",
    atualizado_em: "",
    ...p,
  };
}

const v = (captacao_id: string, lista_id: string, ordem = 0): CaptacaoLista => ({
  captacao_id,
  lista_id,
  ordem,
  criado_em: "",
});

describe("corDaLista", () => {
  it("resolve a cor declarada", () => {
    expect(corDaLista(lista({ cor: "ambar" }))).toBe(COR_LISTA.ambar);
  });
  it("cor desconhecida no banco não quebra a tela", () => {
    expect(corDaLista({ cor: "turquesa" } as unknown as Lista)).toBe(COR_LISTA.cinza);
  });
});

describe("indexarListas", () => {
  const listas = [
    lista({ id: "prio", nome: "Prioridade", ordem: 1000 }),
    lista({ id: "esp", nome: "Seleção Especial", ordem: 2000 }),
  ];

  it("agrupa as listas por captação", () => {
    const idx = indexarListas([v("a", "prio"), v("a", "esp"), v("b", "esp")], listas);
    expect(idx.get("a")?.map((l) => l.id)).toEqual(["prio", "esp"]);
    expect(idx.get("b")?.map((l) => l.id)).toEqual(["esp"]);
  });

  it("respeita a ordem de exibição das listas, não a dos vínculos", () => {
    const idx = indexarListas([v("a", "esp"), v("a", "prio")], listas);
    expect(idx.get("a")?.map((l) => l.id)).toEqual(["prio", "esp"]);
  });

  it("vínculo órfão (lista apagada) é ignorado", () => {
    const idx = indexarListas([v("a", "sumiu")], listas);
    expect(idx.has("a")).toBe(false);
  });

  it("captação sem lista simplesmente não aparece", () => {
    expect(indexarListas([], listas).size).toBe(0);
  });
});

describe("captacoesDaLista", () => {
  it("devolve só os ids daquela lista", () => {
    const set = captacoesDaLista([v("a", "prio"), v("b", "esp"), v("c", "prio")], "prio");
    expect([...set].sort()).toEqual(["a", "c"]);
  });
});

describe("ordemNaLista", () => {
  it("mapeia a sequência de gravação daquela lista", () => {
    const m = ordemNaLista([v("a", "prio", 200), v("b", "prio", 100), v("c", "esp", 50)], "prio");
    expect(m.get("a")).toBe(200);
    expect(m.get("b")).toBe(100);
    expect(m.has("c")).toBe(false);
  });
});

describe("separarListas", () => {
  it("permanentes na barra, listas de migração atrás", () => {
    const todas = [
      lista({ id: "mig", nome: "Novas", permanente: false, ordem: 4100 }),
      lista({ id: "gav", nome: "Gaveta", permanente: true, ordem: 3000 }),
      lista({ id: "prio", nome: "Prioridade", permanente: true, ordem: 1000 }),
    ];
    const { fixas, migracao } = separarListas(todas);
    expect(fixas.map((l) => l.id)).toEqual(["prio", "gav"]);
    expect(migracao.map((l) => l.id)).toEqual(["mig"]);
  });
});
