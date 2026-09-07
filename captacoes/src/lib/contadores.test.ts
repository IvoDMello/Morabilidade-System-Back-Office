import { describe, it, expect } from "vitest";
import { contadores, hojeLocal } from "./contadores";
import type { Captacao } from "@/types";

const HOJE = "2026-09-07";

function card(p: Partial<Captacao>): Captacao {
  return {
    id: Math.random().toString(36),
    endereco: "",
    status: "novas",
    ordem: 0,
    decisao: null,
    retorno_feito: false,
    retorno_prazo: null,
    retorno_responsavel: null,
    visita_concluida: false,
    visita_data: null,
    visita_em: null,
    gravacao_concluida: false,
    gravacao_data: null,
    gravacao_em: null,
    criado_em: "2026-09-01T10:00:00Z",
    decisao_em: null,
    ...p,
  } as Captacao;
}

describe("contadores", () => {
  it("conta cada aba pela etapa derivada", () => {
    const cards = [
      card({ status: "novas" }),
      card({ status: "em_decisao" }),
      card({ status: "pendente_agendar_visita", decisao: "aprovada" }),
      card({ status: "negativada", decisao: "reprovada", retorno_feito: true }),
    ];
    const n = contadores(cards, HOJE, "u1");
    expect(n.decidir).toBe(2);
    expect(n.aprovadas).toBe(1);
  });

  it("a agenda conta pendências de agendamento, não captações", () => {
    const cards = [
      card({ status: "pendente_agendar_visita", decisao: "aprovada" }),
      card({
        status: "pendente_agendar_gravacao",
        decisao: "aprovada",
        visita_data: "2026-09-01",
        gravacao_data: "2026-09-02",
      }),
    ];
    const n = contadores(cards, HOJE, "u1");
    expect(n.aprovadas).toBe(2);
    expect(n.agenda).toBe(1);
  });

  it("negativadas e atrasados olham só os retornos do usuário", () => {
    const cards = [
      card({ status: "pendente_negativa", decisao: "reprovada", retorno_responsavel: "u1", retorno_prazo: "2026-09-01" }),
      card({ status: "pendente_negativa", decisao: "reprovada", retorno_responsavel: "u1", retorno_prazo: "2026-09-30" }),
      card({ status: "pendente_negativa", decisao: "reprovada", retorno_responsavel: "u2", retorno_prazo: "2026-09-01" }),
    ];
    const n = contadores(cards, HOJE, "u1");
    expect(n.negativadas).toBe(2);
    expect(n.atrasados).toBe(1);
  });

  it("engavetada sem decisão cai em Decidir, não em Aprovadas", () => {
    const n = contadores([card({ status: "gaveta", decisao: null })], HOJE, "u1");
    expect(n.decidir).toBe(1);
    expect(n.aprovadas).toBe(0);
  });

  it("base vazia zera tudo", () => {
    expect(contadores([], HOJE, "u1")).toEqual({
      decidir: 0,
      aprovadas: 0,
      agenda: 0,
      negativadas: 0,
      atrasados: 0,
    });
  });
});

describe("hojeLocal", () => {
  it("usa o dia do fuso do navegador, não o UTC", () => {
    // 23h de 6/9 em São Paulo (UTC-3) já é 7/9 em UTC: o dia que a pessoa
    // está vivendo é o 6, e é esse que vale para prazo de retorno.
    const local = new Date(2026, 8, 6, 23, 0, 0);
    expect(hojeLocal(local)).toBe("2026-09-06");
  });

  it("preenche mês e dia com zero à esquerda", () => {
    expect(hojeLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
