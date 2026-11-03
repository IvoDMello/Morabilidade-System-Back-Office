import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/stores/app";
import { passos, supabaseFalso } from "@/test/supabase-falso";
import type { Captacao, CaptacaoLista, Lista } from "@/types";
import {
  alternarLista,
  criarLista,
  editarLista,
  excluirLista,
  moverNaSequencia,
  quantasNaLista,
} from "./listas-api";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

/**
 * Escritas das listas: aplica otimista no store, grava, e desfaz se o banco
 * recusar. A tradução dos erros (`motivo`) está em listas-api.test.ts.
 */

const lista = (id: string, ordem: number): Lista =>
  ({ id, nome: `Lista ${id}`, cor: "cinza", permanente: false, ordem }) as Lista;
const vinculo = (captacao_id: string, lista_id: string, ordem: number): CaptacaoLista =>
  ({ captacao_id, lista_id, ordem, criado_em: "" }) as CaptacaoLista;

function usar(db: ReturnType<typeof supabaseFalso>) {
  vi.mocked(createClient).mockReturnValue(db as never);
  return db;
}

beforeEach(() => {
  useApp.setState({
    listas: [lista("a", 10), lista("b", 20)],
    vinculos: [vinculo("c1", "a", 5), vinculo("c2", "a", 7)],
    cards: [{ id: "c1", ordem: 1 } as Captacao],
    userId: "ivo",
  });
});

describe("criar, editar e excluir lista", () => {
  it("cria no fim da barra, com autor e nome aparado, e põe no store", async () => {
    const db = usar(supabaseFalso({ lista: { data: lista("n", 30) } }));
    const r = await criarLista("  Vista mar ", "verde" as Lista["cor"]);
    expect(r.ok).toBe(true);
    const insert = passos(db.chamadas[0]).insert[0] as Record<string, unknown>;
    expect(insert).toMatchObject({ nome: "Vista mar", permanente: false, criado_por: "ivo" });
    expect(insert.ordem as number).toBeGreaterThan(20);
    expect(useApp.getState().listas.map((l) => l.id)).toContain("n");
  });

  it("erro na criação devolve o motivo traduzido", async () => {
    usar(supabaseFalso({ lista: { error: { code: "23505" } } }));
    expect(await criarLista("A", "cinza" as Lista["cor"])).toEqual({ ok: false, erro: "Já existe uma lista com esse nome." });
  });

  it("editar apara o nome; só a cor passa intacta", async () => {
    const db = usar(supabaseFalso({ lista: { data: { ...lista("a", 10), nome: "Novo" } } }));
    expect(await editarLista("a", { nome: " Novo " })).toEqual({ ok: true, dados: undefined });
    expect(passos(db.chamadas[0]).update[0]).toEqual({ nome: "Novo" });
    expect(useApp.getState().listas.find((l) => l.id === "a")?.nome).toBe("Novo");

    const db2 = usar(supabaseFalso({ lista: { data: lista("a", 10) } }));
    await editarLista("a", { cor: "azul" as Lista["cor"] });
    expect(passos(db2.chamadas[0]).update[0]).toEqual({ cor: "azul" });

    usar(supabaseFalso({ lista: { error: { code: "23514" } } }));
    expect(await editarLista("a", { nome: "" })).toEqual({ ok: false, erro: "O nome precisa ter entre 1 e 40 caracteres." });
  });

  it("excluir tira a lista do store; lista permanente devolve a frase da trigger", async () => {
    usar(supabaseFalso());
    expect(await excluirLista("b")).toEqual({ ok: true, dados: undefined });
    expect(useApp.getState().listas.map((l) => l.id)).toEqual(["a"]);

    const msg = 'A lista "Gaveta" é permanente e não pode ser apagada.';
    usar(supabaseFalso({ lista: { error: { code: "23001", message: msg } } }));
    expect(await excluirLista("a")).toEqual({ ok: false, erro: msg });
  });

  it("quantasNaLista conta as captações que perderiam a etiqueta", () => {
    expect(quantasNaLista("a")).toBe(2);
    expect(quantasNaLista("b")).toBe(0);
  });
});

describe("alternarLista", () => {
  const naLista = (c: string, l: string) =>
    useApp.getState().vinculos.some((v) => v.captacao_id === c && v.lista_id === l);

  it("põe no fim da sequência da lista", async () => {
    const db = usar(supabaseFalso());
    expect(await alternarLista("c3", "a", true)).toBe(true);
    const upsert = passos(db.chamadas[0]).upsert[0] as { ordem: number };
    expect(upsert.ordem).toBeGreaterThan(7);
    expect(naLista("c3", "a")).toBe(true);
  });

  it("primeira captação de uma lista vazia também entra", async () => {
    usar(supabaseFalso());
    expect(await alternarLista("c3", "b", true)).toBe(true);
    expect(naLista("c3", "b")).toBe(true);
  });

  it("desfaz se o banco recusar a entrada", async () => {
    usar(supabaseFalso({ captacao_lista: { error: { message: "rls" } } }));
    expect(await alternarLista("c3", "a", true)).toBe(false);
    expect(naLista("c3", "a")).toBe(false);
  });

  it("tira da lista e desfaz se o banco recusar", async () => {
    const db = usar(supabaseFalso());
    expect(await alternarLista("c1", "a", false)).toBe(true);
    expect(naLista("c1", "a")).toBe(false);
    expect(passos(db.chamadas[0])).toHaveProperty("delete");

    usar(supabaseFalso({ captacao_lista: { error: { message: "rls" } } }));
    expect(await alternarLista("c2", "a", false)).toBe(false);
    expect(naLista("c2", "a")).toBe(true);
  });
});

describe("moverNaSequencia", () => {
  const ordemNaLista = (c: string, l: string) =>
    useApp.getState().vinculos.find((v) => v.captacao_id === c && v.lista_id === l)?.ordem;

  it("dentro de uma lista grava a ordem do vínculo entre os vizinhos", async () => {
    const db = usar(supabaseFalso());
    expect(await moverNaSequencia("c2", "a", null, 5)).toBe(true);
    expect(ordemNaLista("c2", "a")).toBeLessThan(5);
    expect(passos(db.chamadas[0]).eq).toEqual(["lista_id", "a"]);
  });

  it("dentro de uma lista volta a ordem anterior se falhar", async () => {
    usar(supabaseFalso({ captacao_lista: { error: { message: "x" } } }));
    expect(await moverNaSequencia("c2", "a", null, 5)).toBe(false);
    expect(ordemNaLista("c2", "a")).toBe(7);
  });

  it("sem lista mexe na ordem geral do cartão, com rollback", async () => {
    const db = usar(supabaseFalso());
    expect(await moverNaSequencia("c1", null, 1, 2)).toBe(true);
    expect(useApp.getState().find("c1")?.ordem).toBeCloseTo(1.5);
    expect(db.chamadas[0].alvo).toBe("captacao");

    usar(supabaseFalso({ captacao: { error: { message: "x" } } }));
    expect(await moverNaSequencia("c1", null, 3, 4)).toBe(false);
    expect(useApp.getState().find("c1")?.ordem).toBeCloseTo(1.5);
  });
});
