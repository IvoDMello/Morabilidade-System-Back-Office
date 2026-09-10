import { describe, it, expect } from "vitest";
import {
  COR_LISTA,
  captacoesDaLista,
  contarPorLista,
  corDaLista,
  indexarListas,
  ordemNaLista,
  pillsDaBarra,
  separarListas,
} from "./listas";
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

describe("contarPorLista", () => {
  const vivos = new Set(["c1", "c2", "c3"]);

  it("separa o que a aba mostra do que está fora dela", () => {
    const n = contarPorLista([v("c1", "a"), v("c2", "a"), v("c3", "a")], new Set(["c1"]), vivos);
    expect(n.get("a")).toEqual({ aqui: 1, fora: 2 });
  });

  it("lista só com captações de outra etapa não é um zero seco", () => {
    // O caso que confundia: etiquetei dois cartões em Decidir e a pill
    // marcava "0" como se nada tivesse pegado.
    const n = contarPorLista([v("c2", "a"), v("c3", "a")], new Set(["c1"]), vivos);
    expect(n.get("a")).toEqual({ aqui: 0, fora: 2 });
  });

  it("ignora vínculo de captação que foi para a lixeira", () => {
    // `excluido_em` é exclusão lógica: o vínculo continua na tabela.
    const n = contarPorLista([v("c1", "a"), v("morta", "a")], new Set(["c1"]), vivos);
    expect(n.get("a")).toEqual({ aqui: 1, fora: 0 });
  });

  it("lista sem nenhum vínculo não entra no mapa", () => {
    expect(contarPorLista([], new Set(), vivos).get("a")).toBeUndefined();
  });
});

describe("pillsDaBarra", () => {
  const prioridade = lista({ id: "p", nome: "Prioridade", permanente: true, ordem: 1000 });
  const gaveta = lista({ id: "g", nome: "Gaveta", permanente: true, ordem: 3000 });
  // Herdada da virada v2: a migration 0021 inseriu sem autor.
  const herdada = lista({ id: "m", nome: "Novas", permanente: false, ordem: 4100 });
  // Criada pela tela hoje: grava quem criou.
  const minha = lista({ id: "n", nome: "Fora de área", permanente: false, ordem: 5000, criado_por: "u1" });
  const todas = [prioridade, gaveta, herdada, minha];
  const cont = (m: Record<string, { aqui: number; fora: number }>) => new Map(Object.entries(m));

  it("recolhida, esconde a herdada sem captação na aba", () => {
    const { mostradas, ocultas } = pillsDaBarra(todas, cont({}), null, false);
    expect(mostradas.map((l) => l.id)).toEqual(["p", "g", "n"]);
    expect(ocultas).toBe(1);
  });

  it("recolhida, mostra a herdada que tem captação na aba", () => {
    const { mostradas, ocultas } = pillsDaBarra(todas, cont({ m: { aqui: 3, fora: 0 } }), null, false);
    expect(mostradas.map((l) => l.id)).toEqual(["p", "g", "m", "n"]);
    expect(ocultas).toBe(0);
  });

  it("a lista criada por alguém nunca some, mesmo vazia", () => {
    // Ela nasce vazia e etiquetar por Decidir não mexe no `aqui`: escondendo,
    // a pessoa criava a lista, usava, e não achava mais de onde editá-la.
    const { mostradas } = pillsDaBarra(todas, cont({ n: { aqui: 0, fora: 2 } }), null, false);
    expect(mostradas.map((l) => l.id)).toContain("n");
  });

  it("a lista ativa aparece mesmo sendo herdada e vazia", () => {
    const { mostradas, ocultas } = pillsDaBarra(todas, cont({}), "m", false);
    expect(mostradas.map((l) => l.id)).toEqual(["p", "g", "m", "n"]);
    expect(ocultas).toBe(0);
  });

  it('"ver todas" revela até as vazias — é o único caminho para editar ou apagar', () => {
    const { mostradas, ocultas } = pillsDaBarra(todas, cont({}), null, true);
    expect(mostradas.map((l) => l.id)).toEqual(["p", "g", "m", "n"]);
    expect(ocultas).toBe(0);
  });

  it("permanente vazia nunca some da barra", () => {
    const { mostradas } = pillsDaBarra([prioridade, gaveta], cont({}), null, false);
    expect(mostradas.map((l) => l.id)).toEqual(["p", "g"]);
  });

  it("respeita a ordem declarada, permanentes na frente", () => {
    const fora = [minha, gaveta, herdada, prioridade];
    const { mostradas } = pillsDaBarra(fora, cont({}), null, true);
    expect(mostradas.map((l) => l.id)).toEqual(["p", "g", "m", "n"]);
  });
});
