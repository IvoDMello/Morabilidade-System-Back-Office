import { describe, it, expect } from "vitest";
import {
  ordemNoFim,
  ordemNaPosicao,
  progresso,
  textoDaCaptacao,
  diasAteData,
  rotuloData,
  ordemAoMover,
} from "./pauta";
import type { PautaItem } from "@/types";

const item = (ordem: number, concluido = false) => ({ ordem, concluido }) as PautaItem;

describe("ordemNoFim", () => {
  it("lista vazia começa no passo padrão", () => {
    expect(ordemNoFim([])).toBe(1024);
  });
  it("depois do último", () => {
    expect(ordemNoFim([{ ordem: 10 }, { ordem: 20 }])).toBe(1044);
  });
});

describe("ordemNaPosicao", () => {
  const lista = [{ ordem: 100 }, { ordem: 200 }, { ordem: 300 }];
  it("topo da lista", () => {
    expect(ordemNaPosicao(lista, 0)).toBeLessThan(100);
  });
  it("meio da lista fica entre os vizinhos", () => {
    const r = ordemNaPosicao(lista, 1);
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(200);
  });
  it("index igual ao tamanho = fim", () => {
    expect(ordemNaPosicao(lista, 3)).toBeGreaterThan(300);
  });
  it("lista vazia", () => {
    expect(ordemNaPosicao([], 0)).toBe(1024);
  });
});

describe("progresso", () => {
  it("conta concluídos e total", () => {
    expect(progresso([item(1, true), item(2), item(3, true)])).toEqual({ feitos: 2, total: 3 });
  });
  it("pauta vazia", () => {
    expect(progresso([])).toEqual({ feitos: 0, total: 0 });
  });
});

describe("textoDaCaptacao", () => {
  it("junta endereço, unidade e bairro", () => {
    expect(textoDaCaptacao({ endereco: "Rua Chile 220", unidade: "802", bairro: "Centro" })).toBe(
      "Rua Chile 220 · ap 802 · Centro"
    );
  });
  it("ignora campos vazios", () => {
    expect(textoDaCaptacao({ endereco: " Av. Atlântica 1500 ", unidade: "", bairro: null })).toBe(
      "Av. Atlântica 1500"
    );
  });
});

describe("diasAteData", () => {
  const agora = new Date(2026, 7, 27, 15, 0, 0); // 27/08/2026, meio da tarde
  it("hoje é zero mesmo com hora avançada", () => {
    expect(diasAteData("2026-08-27", agora)).toBe(0);
  });
  it("amanhã é 1", () => {
    expect(diasAteData("2026-08-28", agora)).toBe(1);
  });
  it("ontem é -1", () => {
    expect(diasAteData("2026-08-26", agora)).toBe(-1);
  });
  it("atravessa a virada do mês", () => {
    expect(diasAteData("2026-09-03", agora)).toBe(7);
  });
});

describe("rotuloData", () => {
  const agora = new Date(2026, 7, 27, 9, 0, 0);
  it.each([
    ["2026-08-27", "hoje"],
    ["2026-08-28", "amanhã"],
    ["2026-08-30", "em 3d"],
    ["2026-08-26", "atrasada 1d"],
    ["2026-08-24", "atrasada 3d"],
  ])("%s -> %s", (ymd, esperado) => {
    expect(rotuloData(ymd, agora)).toBe(esperado);
  });
});

describe("ordemAoMover", () => {
  const lista = [{ ordem: 100 }, { ordem: 200 }, { ordem: 300 }];
  it("sobe o último para o meio", () => {
    expect(ordemAoMover(lista, 2, -1)).toBe(150);
  });
  it("desce o primeiro para o meio", () => {
    expect(ordemAoMover(lista, 0, 1)).toBe(250);
  });
  it("sobe o do meio para o topo", () => {
    expect(ordemAoMover(lista, 1, -1)).toBeLessThan(100);
  });
  it("desce o do meio para o fim", () => {
    expect(ordemAoMover(lista, 1, 1)).toBeGreaterThan(300);
  });
  it("null nas pontas", () => {
    expect(ordemAoMover(lista, 0, -1)).toBeNull();
    expect(ordemAoMover(lista, 2, 1)).toBeNull();
  });
  it("null com índice fora da lista", () => {
    expect(ordemAoMover(lista, 9, -1)).toBeNull();
  });
});
