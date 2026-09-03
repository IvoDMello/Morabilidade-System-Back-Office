import { describe, it, expect, beforeEach } from "vitest";
import { usePauta } from "./pauta";
import type { Pauta, PautaItem } from "@/types";

const pauta = (id: string, ordem: number): Pauta =>
  ({ id, titulo: `Pauta ${id}`, ordem }) as Pauta;

const item = (id: string, pautaId: string, ordem: number): PautaItem =>
  ({ id, pauta_id: pautaId, texto: `Item ${id}`, ordem }) as PautaItem;

beforeEach(() => {
  usePauta.getState().setTudo([], []);
});

describe("pauta store", () => {
  it("setTudo ordena pautas e agrupa itens por pauta", () => {
    usePauta.getState().setTudo(
      [pauta("p2", 20), pauta("p1", 10)],
      [item("b", "p1", 20), item("a", "p1", 10), item("c", "p2", 5)]
    );
    const s = usePauta.getState();
    expect(s.pautas.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(s.itens.p1.map((i) => i.id)).toEqual(["a", "b"]);
    expect(s.itens.p2.map((i) => i.id)).toEqual(["c"]);
  });

  it("itensDe devolve a mesma referência quando a pauta não tem itens", () => {
    const { itensDe } = usePauta.getState();
    expect(itensDe("inexistente")).toBe(itensDe("outra"));
  });

  it("upsertItem que troca de pauta não deixa cópia na antiga", () => {
    usePauta.getState().setTudo([pauta("p1", 10), pauta("p2", 20)], [item("a", "p1", 10)]);
    usePauta.getState().upsertItem({ ...item("a", "p2", 5) });
    const s = usePauta.getState();
    expect(s.itens.p1).toEqual([]);
    expect(s.itens.p2.map((i) => i.id)).toEqual(["a"]);
  });

  it("moverItem reposiciona dentro da mesma pauta", () => {
    usePauta
      .getState()
      .setTudo([pauta("p1", 10)], [item("a", "p1", 10), item("b", "p1", 20), item("c", "p1", 30)]);
    usePauta.getState().moverItem("c", "p1", 15);
    expect(usePauta.getState().itens.p1.map((i) => i.id)).toEqual(["a", "c", "b"]);
  });

  it("moverItem entre pautas tira da origem e ordena no destino", () => {
    usePauta
      .getState()
      .setTudo(
        [pauta("p1", 10), pauta("p2", 20)],
        [item("a", "p1", 10), item("b", "p2", 10), item("c", "p2", 30)]
      );
    usePauta.getState().moverItem("a", "p2", 20);
    const s = usePauta.getState();
    expect(s.itens.p1.map((i) => i.id)).toEqual([]);
    expect(s.itens.p2.map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  it("moverItem ignora id desconhecido", () => {
    usePauta.getState().setTudo([pauta("p1", 10)], [item("a", "p1", 10)]);
    usePauta.getState().moverItem("zzz", "p1", 1);
    expect(usePauta.getState().itens.p1.map((i) => i.id)).toEqual(["a"]);
  });

  it("removePauta leva junto os itens dela", () => {
    usePauta
      .getState()
      .setTudo([pauta("p1", 10), pauta("p2", 20)], [item("a", "p1", 10), item("b", "p2", 10)]);
    usePauta.getState().removePauta("p1");
    const s = usePauta.getState();
    expect(s.pautas.map((p) => p.id)).toEqual(["p2"]);
    expect(s.itens.p1).toBeUndefined();
    expect(s.itens.p2).toHaveLength(1);
  });

  it("moverPauta reordena a raia", () => {
    usePauta.getState().setTudo([pauta("p1", 10), pauta("p2", 20), pauta("p3", 30)], []);
    usePauta.getState().moverPauta("p3", 15);
    expect(usePauta.getState().pautas.map((p) => p.id)).toEqual(["p1", "p3", "p2"]);
  });

  it("acharItem varre todas as pautas", () => {
    usePauta.getState().setTudo([pauta("p1", 10), pauta("p2", 20)], [item("b", "p2", 10)]);
    expect(usePauta.getState().acharItem("b")?.pauta_id).toBe("p2");
    expect(usePauta.getState().acharItem("zzz")).toBeUndefined();
  });
});
