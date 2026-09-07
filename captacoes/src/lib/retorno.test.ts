import { describe, it, expect } from "vitest";
import {
  contarAtrasados,
  historicoNegativadas,
  ordenarRetornos,
  precisaRetorno,
  retornosPendentes,
  situacaoRetorno,
} from "./retorno";
import type { Captacao } from "@/types";

const HOJE = "2026-09-07";

function card(p: Partial<Captacao>): Captacao {
  return {
    id: "c1",
    endereco: "",
    status: "pendente_negativa",
    ordem: 0,
    decisao: "reprovada",
    retorno_feito: false,
    retorno_prazo: null,
    retorno_responsavel: null,
    decisao_em: "2026-09-01T10:00:00Z",
    criado_em: "2026-08-01T10:00:00Z",
    ...p,
  } as Captacao;
}

describe("precisaRetorno", () => {
  it("só reprovada e ainda não avisada", () => {
    expect(precisaRetorno(card({}))).toBe(true);
    expect(precisaRetorno(card({ retorno_feito: true }))).toBe(false);
    expect(precisaRetorno(card({ decisao: "aprovada" }))).toBe(false);
    expect(precisaRetorno(card({ decisao: null }))).toBe(false);
  });
});

describe("situacaoRetorno", () => {
  it("classifica pelo prazo, comparando por dia", () => {
    expect(situacaoRetorno(card({ retorno_prazo: "2026-09-04" }), HOJE)).toBe("atrasado");
    expect(situacaoRetorno(card({ retorno_prazo: HOJE }), HOJE)).toBe("hoje");
    expect(situacaoRetorno(card({ retorno_prazo: "2026-09-12" }), HOJE)).toBe("futuro");
  });

  it("sem prazo NÃO é atrasado — é o caso dos dados migrados da v1", () => {
    expect(situacaoRetorno(card({ retorno_prazo: null }), HOJE)).toBe("sem_prazo");
  });
});

describe("ordenarRetornos", () => {
  it("atrasados primeiro, sem prazo por último", () => {
    const fila = [
      card({ id: "futuro", retorno_prazo: "2026-09-12" }),
      card({ id: "sem", retorno_prazo: null }),
      card({ id: "atrasado", retorno_prazo: "2026-09-04" }),
      card({ id: "hoje", retorno_prazo: HOJE }),
    ];
    expect(ordenarRetornos(fila, HOJE).map((c) => c.id)).toEqual(["atrasado", "hoje", "futuro", "sem"]);
  });

  it("dentro do grupo, o mais vencido no topo", () => {
    const fila = [
      card({ id: "menos", retorno_prazo: "2026-09-05" }),
      card({ id: "mais", retorno_prazo: "2026-09-01" }),
    ];
    expect(ordenarRetornos(fila, HOJE).map((c) => c.id)).toEqual(["mais", "menos"]);
  });

  it("sem prazo desempata pela decisão mais antiga", () => {
    const fila = [
      card({ id: "nova", retorno_prazo: null, decisao_em: "2026-09-05T10:00:00Z" }),
      card({ id: "velha", retorno_prazo: null, decisao_em: "2026-07-05T10:00:00Z" }),
    ];
    expect(ordenarRetornos(fila, HOJE).map((c) => c.id)).toEqual(["velha", "nova"]);
  });

  it("não muta o array recebido", () => {
    const fila = [card({ id: "b", retorno_prazo: "2026-09-12" }), card({ id: "a", retorno_prazo: "2026-09-01" })];
    const antes = fila.map((c) => c.id);
    ordenarRetornos(fila, HOJE);
    expect(fila.map((c) => c.id)).toEqual(antes);
  });
});

describe("retornosPendentes", () => {
  const fila = [
    card({ id: "meu", retorno_responsavel: "u1", retorno_prazo: "2026-09-04" }),
    card({ id: "dele", retorno_responsavel: "u2", retorno_prazo: "2026-09-05" }),
    card({ id: "orfao", retorno_responsavel: null }),
    card({ id: "feito", retorno_responsavel: "u1", retorno_feito: true }),
  ];

  it('sem userId devolve o time inteiro ("Todas")', () => {
    expect(retornosPendentes(fila, HOJE).map((c) => c.id)).toEqual(["meu", "dele", "orfao"]);
  });

  it('com userId devolve só os da pessoa ("Suas")', () => {
    expect(retornosPendentes(fila, HOJE, "u1").map((c) => c.id)).toEqual(["meu"]);
  });

  it("quem já teve retorno some da fila", () => {
    expect(retornosPendentes(fila, HOJE, "u1").some((c) => c.id === "feito")).toBe(false);
  });
});

describe("contarAtrasados", () => {
  it("conta só o que venceu, e só da pessoa quando pedido", () => {
    const fila = [
      card({ id: "a", retorno_responsavel: "u1", retorno_prazo: "2026-09-01" }),
      card({ id: "b", retorno_responsavel: "u1", retorno_prazo: "2026-09-30" }),
      card({ id: "c", retorno_responsavel: "u2", retorno_prazo: "2026-09-01" }),
      card({ id: "d", retorno_responsavel: "u1", retorno_prazo: null }),
    ];
    expect(contarAtrasados(fila, HOJE, "u1")).toBe(1);
    expect(contarAtrasados(fila, HOJE)).toBe(2);
  });
});

describe("historicoNegativadas", () => {
  it("só as resolvidas, mais recentes primeiro", () => {
    const lst = [
      card({ id: "velha", retorno_feito: true, decisao_em: "2026-07-01T10:00:00Z" }),
      card({ id: "pendente" }),
      card({ id: "nova", retorno_feito: true, decisao_em: "2026-09-01T10:00:00Z" }),
    ];
    expect(historicoNegativadas(lst).map((c) => c.id)).toEqual(["nova", "velha"]);
  });
});
