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
  it("etapa Negativadas e ainda não avisada", () => {
    expect(precisaRetorno(card({}))).toBe(true);
    expect(precisaRetorno(card({ retorno_feito: true }))).toBe(false);
  });

  it("quem não está na etapa Negativadas não deve retorno", () => {
    expect(precisaRetorno(card({ status: "novas", decisao: null }))).toBe(false);
    expect(precisaRetorno(card({ status: "pendente_agendar_visita", decisao: "aprovada" }))).toBe(false);
  });

  it("vale a etapa, não o campo decisao — dado sujo do quadro antigo conta", () => {
    // Existem em produção: pendente_negativa marcada como 'aprovada' e
    // negativada com decisao nula. Antes elas sumiam da interface inteira.
    expect(precisaRetorno(card({ status: "pendente_negativa", decisao: "aprovada" }))).toBe(true);
    expect(precisaRetorno(card({ status: "negativada", decisao: null, retorno_feito: false }))).toBe(true);
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

  it("não puxa quem está em outra etapa", () => {
    const lst = [card({ id: "aprovada", status: "pendente_agendar_visita", decisao: "aprovada", retorno_feito: true })];
    expect(historicoNegativadas(lst)).toHaveLength(0);
  });
});

describe("botão \"Retorno dado\" tira da fila e joga no histórico", () => {
  // O que o botão do cartão faz é exatamente isto: virar `retorno_feito`.
  // Este teste tranca o efeito de ponta a ponta — sair de "retornos
  // pendentes" e aparecer em "histórico de negativadas" — porque é o único
  // caminho da aba para arquivar uma negativada.
  const pendente = card({ id: "x", retorno_responsavel: "u1", retorno_prazo: "2026-09-10" });

  it("antes do clique, está na fila e fora do histórico", () => {
    expect(retornosPendentes([pendente], HOJE, "u1").map((c) => c.id)).toEqual(["x"]);
    expect(historicoNegativadas([pendente])).toHaveLength(0);
  });

  it("depois do clique, sai da fila e entra no histórico", () => {
    const depois = { ...pendente, retorno_feito: true, retorno_feito_por: "u1" } as Captacao;
    expect(retornosPendentes([depois], HOJE, "u1")).toHaveLength(0);
    expect(retornosPendentes([depois], HOJE)).toHaveLength(0);
    expect(historicoNegativadas([depois]).map((c) => c.id)).toEqual(["x"]);
  });

  it("e para de contar como atrasado", () => {
    const vencido = card({ id: "v", retorno_responsavel: "u1", retorno_prazo: "2026-09-01" });
    expect(contarAtrasados([vencido], HOJE, "u1")).toBe(1);
    expect(contarAtrasados([{ ...vencido, retorno_feito: true } as Captacao], HOJE, "u1")).toBe(0);
  });
});

describe("nenhuma captação da etapa Negativadas some da tela", () => {
  // Distribuição real da base em 07/09/2026, do retrato por status × decisão.
  // A aba só desenha duas seções: retornos pendentes e histórico. Toda
  // captação cuja etapa é 'negativada' precisa cair em exatamente uma delas.
  const base: Captacao[] = [
    card({ id: "pn-aprovada", status: "pendente_negativa", decisao: "aprovada", retorno_feito: false }),
    card({ id: "neg-sem-1", status: "negativada", decisao: null, retorno_feito: true }),
    card({ id: "neg-sem-2", status: "negativada", decisao: null, retorno_feito: true }),
    card({ id: "neg-sem-3", status: "negativada", decisao: null, retorno_feito: true }),
    card({ id: "neg-aprovada", status: "negativada", decisao: "aprovada", retorno_feito: true }),
    card({ id: "neg-reprovada", status: "negativada", decisao: "reprovada", retorno_feito: true }),
    // Fora da etapa: não podem aparecer em nenhuma das duas seções.
    card({ id: "novas", status: "novas", decisao: null }),
    card({ id: "aprovada", status: "pendente_agendar_visita", decisao: "aprovada" }),
    card({ id: "gaveta-sem", status: "gaveta", decisao: null }),
  ];

  const daEtapa = ["pn-aprovada", "neg-sem-1", "neg-sem-2", "neg-sem-3", "neg-aprovada", "neg-reprovada"];

  it("cada uma aparece em exatamente uma seção", () => {
    const pendentes = retornosPendentes(base, HOJE).map((c) => c.id);
    const historico = historicoNegativadas(base).map((c) => c.id);

    expect([...pendentes, ...historico].sort()).toEqual([...daEtapa].sort());
    expect(pendentes.filter((id) => historico.includes(id))).toEqual([]);
  });

  it("a pendente_negativa marcada como aprovada continua cobrando retorno", () => {
    expect(retornosPendentes(base, HOJE).map((c) => c.id)).toContain("pn-aprovada");
  });

  it("captação de outra etapa não vaza para a aba", () => {
    const naAba = [
      ...retornosPendentes(base, HOJE).map((c) => c.id),
      ...historicoNegativadas(base).map((c) => c.id),
    ];
    expect(naAba).not.toContain("novas");
    expect(naAba).not.toContain("aprovada");
    expect(naAba).not.toContain("gaveta-sem");
  });
});
