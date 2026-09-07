import { describe, it, expect } from "vitest";
import {
  agruparPorMes,
  diaDaGravacao,
  gravacoesNoPeriodo,
  mesAnterior,
  mesDe,
  resumoGravacoes,
} from "./gravacoes";
import type { Captacao } from "@/types";

function card(p: Partial<Captacao>): Captacao {
  return {
    id: "c1",
    endereco: "",
    status: "pendente_agendar_gravacao",
    ordem: 0,
    gravacao_concluida: true,
    gravacao_data: null,
    gravacao_em: null,
    imovel_codigo: null,
    publicada_em: null,
    bairro: null,
    ...p,
  } as Captacao;
}

describe("diaDaGravacao", () => {
  it("prefere a data com hora", () => {
    expect(diaDaGravacao(card({ gravacao_em: "2026-09-05T10:00:00Z", gravacao_data: "2026-09-06" }))).toBe("2026-09-05");
  });
  it("cai na data pura", () => {
    expect(diaDaGravacao(card({ gravacao_data: "2026-09-06" }))).toBe("2026-09-06");
  });
  it("null quando não gravou", () => {
    expect(diaDaGravacao(card({}))).toBeNull();
  });
});

describe("mesDe", () => {
  it("devolve o primeiro e o último dia do mês", () => {
    expect(mesDe("2026-09-15")).toEqual({ de: "2026-09-01", ate: "2026-09-30" });
    expect(mesDe("2026-02-10")).toEqual({ de: "2026-02-01", ate: "2026-02-28" });
    expect(mesDe("2024-02-10")).toEqual({ de: "2024-02-01", ate: "2024-02-29" });
    expect(mesDe("2026-12-31")).toEqual({ de: "2026-12-01", ate: "2026-12-31" });
  });
});

describe("mesAnterior", () => {
  it("volta um mês, inclusive na virada do ano", () => {
    expect(mesAnterior(mesDe("2026-09-15"))).toEqual({ de: "2026-08-01", ate: "2026-08-31" });
    expect(mesAnterior(mesDe("2026-01-10"))).toEqual({ de: "2025-12-01", ate: "2025-12-31" });
  });
});

describe("gravacoesNoPeriodo", () => {
  const setembro = mesDe("2026-09-15");
  const lst = [
    card({ id: "dia5", gravacao_data: "2026-09-05" }),
    card({ id: "dia1", gravacao_data: "2026-09-01" }),
    card({ id: "agosto", gravacao_data: "2026-08-29" }),
    card({ id: "naoGravada", gravacao_concluida: false, gravacao_data: "2026-09-03" }),
    card({ id: "semData", gravacao_data: null }),
  ];

  it("filtra pelo período e ordena da mais recente para a mais antiga", () => {
    expect(gravacoesNoPeriodo(lst, setembro).map((c) => c.id)).toEqual(["dia5", "dia1"]);
  });

  it("inclui as bordas do período", () => {
    const so1 = gravacoesNoPeriodo(lst, { de: "2026-09-01", ate: "2026-09-01" });
    expect(so1.map((c) => c.id)).toEqual(["dia1"]);
  });

  it("marcada como concluída mas sem data não conta", () => {
    expect(gravacoesNoPeriodo(lst, setembro).some((c) => c.id === "semData")).toBe(false);
  });

  it("captação já publicada CONTA — é o caso mais completo, não o de fora", () => {
    // A contabilidade não pode perder gravada → cadastrada → publicada. Por
    // isso as publicadas entram na consulta do layout das abas, mesmo não
    // aparecendo em nenhuma delas.
    const publicada = card({
      id: "publicada",
      status: "publicada",
      gravacao_data: "2026-09-03",
      imovel_codigo: "MOR-1298",
      publicada_em: "2026-09-06T10:00:00Z",
    });
    expect(gravacoesNoPeriodo([publicada], setembro).map((c) => c.id)).toEqual(["publicada"]);
    expect(resumoGravacoes([publicada]).publicadas).toBe(1);
  });
});

describe("resumoGravacoes", () => {
  it("separa o que já tem código do que ainda é pendência", () => {
    const gravadas = [
      card({ id: "a", gravacao_data: "2026-09-05", imovel_codigo: "MOR-1301", bairro: "Ipanema", publicada_em: "2026-09-06T10:00:00Z" }),
      card({ id: "b", gravacao_data: "2026-09-04", imovel_codigo: "MOR-1298", bairro: "Ipanema" }),
      card({ id: "c", gravacao_data: "2026-09-02", bairro: "Botafogo" }),
    ];
    expect(resumoGravacoes(gravadas)).toEqual({
      total: 3,
      noSistema: 2,
      semCadastro: 1,
      publicadas: 1,
      bairros: 2,
    });
  });

  it("período vazio zera tudo", () => {
    expect(resumoGravacoes([])).toEqual({ total: 0, noSistema: 0, semCadastro: 0, publicadas: 0, bairros: 0 });
  });
});

describe("agruparPorMes", () => {
  it("agrupa preservando a ordem recebida", () => {
    const gravadas = [
      card({ id: "set2", gravacao_data: "2026-09-05" }),
      card({ id: "set1", gravacao_data: "2026-09-01" }),
      card({ id: "ago", gravacao_data: "2026-08-29" }),
    ];
    const grupos = agruparPorMes(gravadas);
    expect(grupos.map((g) => g.mes)).toEqual(["2026-09", "2026-08"]);
    expect(grupos[0].itens).toHaveLength(2);
  });
});
