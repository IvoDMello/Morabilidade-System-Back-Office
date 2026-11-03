import { describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { passos, supabaseFalso } from "@/test/supabase-falso";
import {
  atualizarItem,
  atualizarPauta,
  carregarPauta,
  criarItem,
  criarPauta,
  excluirItem,
  excluirPauta,
} from "./pauta-api";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

function usar(db: ReturnType<typeof supabaseFalso>) {
  vi.mocked(createClient).mockReturnValue(db as never);
  return db;
}

describe("pauta", () => {
  it("criarPauta grava autor e ordem e devolve a linha", async () => {
    const db = usar(supabaseFalso({ pauta: { data: { id: "p1" } } }, { id: "ivo" }));
    expect(await criarPauta({ titulo: "Leblon", descricao: null, data_alvo: null }, 3)).toEqual({ id: "p1" });
    expect(passos(db.chamadas[0]).insert[0]).toEqual({
      titulo: "Leblon",
      descricao: null,
      data_alvo: null,
      ordem: 3,
      criado_por: "ivo",
    });
  });

  it("criarPauta sem sessão grava autor nulo; erro devolve null", async () => {
    const db = usar(supabaseFalso({ pauta: { data: { id: "p1" } } }, null));
    await criarPauta({ titulo: "x", descricao: null, data_alvo: null }, 1);
    expect((passos(db.chamadas[0]).insert[0] as { criado_por: unknown }).criado_por).toBeNull();

    usar(supabaseFalso({ pauta: { error: { message: "rls" } } }));
    expect(await criarPauta({ titulo: "x", descricao: null, data_alvo: null }, 1)).toBeNull();
  });

  it("atualizar e excluir (soft-delete) dizem se gravou", async () => {
    const db = usar(supabaseFalso());
    expect(await atualizarPauta("p1", { titulo: "Novo" })).toBe(true);
    expect(await excluirPauta("p1")).toBe(true);
    expect(passos(db.chamadas[1]).update[0]).toHaveProperty("excluido_em");
    expect(passos(db.chamadas[1]).eq).toEqual(["id", "p1"]);

    usar(supabaseFalso({ pauta: { error: { message: "x" } } }));
    expect(await atualizarPauta("p1", {})).toBe(false);
  });
});

describe("itens", () => {
  it("criarItem devolve a linha ou null", async () => {
    usar(supabaseFalso({ pauta_item: { data: { id: "i1" } } }));
    expect(await criarItem({ pauta_id: "p1", texto: "Gravar varanda", captacao_id: null }, 1)).toEqual({ id: "i1" });
    usar(supabaseFalso({ pauta_item: { error: { message: "x" } } }));
    expect(await criarItem({ pauta_id: "p1", texto: "x", captacao_id: null }, 1)).toBeNull();
  });

  it("item sai de vez (delete), sem soft-delete", async () => {
    const db = usar(supabaseFalso());
    expect(await atualizarItem("i1", { texto: "y" })).toBe(true);
    expect(await excluirItem("i1")).toBe(true);
    expect(passos(db.chamadas[1])).toHaveProperty("delete");

    usar(supabaseFalso({ pauta_item: { error: { message: "x" } } }));
    expect(await atualizarItem("i1", {})).toBe(false);
    expect(await excluirItem("i1")).toBe(false);
  });
});

describe("carregarPauta", () => {
  it("traz pautas não excluídas e itens, em ordem; vazio vira lista vazia", async () => {
    const db = usar(supabaseFalso({ pauta: { data: [{ id: "p1" }] }, pauta_item: { data: null } }));
    expect(await carregarPauta()).toEqual({ pautas: [{ id: "p1" }], itens: [] });
    expect(passos(db.chamadas[0])).toMatchObject({ is: ["excluido_em", null], order: ["ordem"] });
  });
});
