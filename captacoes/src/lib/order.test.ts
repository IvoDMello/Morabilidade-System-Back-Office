import { describe, it, expect } from "vitest";
import { orderBetween } from "./order";

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
