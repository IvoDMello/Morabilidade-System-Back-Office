import { describe, it, expect } from "vitest";
import { orderBetween, vizinhosDoDestino } from "./order";

describe("orderBetween", () => {
  it("primeira posição do quadro (ambos nulos)", () => {
    expect(orderBetween(null, null)).toBe(1024);
  });
  it("inserir no topo (antes do primeiro)", () => {
    expect(orderBetween(null, 1024)).toBe(0);
  });
  it("inserir no fim (depois do último)", () => {
    expect(orderBetween(1024, null)).toBe(2048);
  });
  it("inserir entre dois vizinhos = ponto médio", () => {
    expect(orderBetween(1024, 2048)).toBe(1536);
  });
  it("resultado fica estritamente entre os vizinhos", () => {
    const r = orderBetween(10, 11);
    expect(r).toBeGreaterThan(10);
    expect(r).toBeLessThan(11);
  });
});

describe("vizinhosDoDestino", () => {
  const ordens = [100, 200, 300, 400];

  it("mover para o topo não tem vizinho antes", () => {
    expect(vizinhosDoDestino(ordens, 2, 0)).toEqual({ antes: null, depois: 100 });
  });

  it("mover para o fim não tem vizinho depois", () => {
    expect(vizinhosDoDestino(ordens, 0, 3)).toEqual({ antes: 400, depois: null });
  });

  it("descer uma casa não compara o item consigo mesmo", () => {
    // Sem tirar a origem da lista, o item cairia entre 200 e 300 — ou seja,
    // continuaria antes do vizinho que deveria ultrapassar.
    expect(vizinhosDoDestino(ordens, 1, 2)).toEqual({ antes: 300, depois: 400 });
  });

  it("subir uma casa cai entre os vizinhos certos", () => {
    expect(vizinhosDoDestino(ordens, 2, 1)).toEqual({ antes: 100, depois: 200 });
  });

  it("fila de um item só devolve as duas pontas vazias", () => {
    expect(vizinhosDoDestino([100], 0, 0)).toEqual({ antes: null, depois: null });
  });
});
