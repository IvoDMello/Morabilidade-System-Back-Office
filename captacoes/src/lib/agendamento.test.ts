import { describe, it, expect } from "vitest";
import {
  agruparPorDia,
  compromissos,
  fimDoCompromisso,
  proximosCompromissos,
  quandoDoCompromisso,
  rotuloDoDia,
} from "./agendamento";
import type { Captacao } from "@/types";

const HOJE = "2026-09-07";

function card(p: Partial<Captacao>): Captacao {
  return {
    id: "c1",
    endereco: "",
    status: "pendente_agendar_visita",
    ordem: 0,
    visita_em: null,
    visita_data: null,
    visita_duracao_min: 60,
    gravacao_em: null,
    gravacao_data: null,
    gravacao_duracao_min: 60,
    ...p,
  } as Captacao;
}

describe("quandoDoCompromisso", () => {
  it("prefere a data com hora", () => {
    const c = card({ visita_em: "2026-09-10T14:00:00Z", visita_data: "2026-09-11" });
    expect(quandoDoCompromisso(c, "visita")).toEqual({ quando: "2026-09-10T14:00:00Z", temHora: true });
  });

  it("cai na data pura dos agendamentos anteriores à v2, sem inventar horário", () => {
    const c = card({ visita_data: "2026-09-11" });
    expect(quandoDoCompromisso(c, "visita")).toEqual({ quando: "2026-09-11T00:00:00", temHora: false });
  });

  it("sem nada agendado, não há compromisso", () => {
    expect(quandoDoCompromisso(card({}), "visita")).toBeNull();
    expect(quandoDoCompromisso(card({}), "gravacao")).toBeNull();
  });
});

describe("compromissos", () => {
  it("junta visita e gravação da mesma captação em ordem cronológica", () => {
    const lst = [
      card({ id: "a", visita_em: "2026-09-10T16:00:00Z", gravacao_em: "2026-09-08T09:00:00Z" }),
      card({ id: "b", visita_em: "2026-09-09T10:00:00Z" }),
    ];
    expect(compromissos(lst).map((k) => `${k.captacao.id}:${k.tipo}`)).toEqual([
      "a:gravacao",
      "b:visita",
      "a:visita",
    ]);
  });

  it("ignora captação sem agendamento", () => {
    expect(compromissos([card({ id: "vazia" })])).toHaveLength(0);
  });
});

describe("proximosCompromissos", () => {
  it("descarta o que já passou, mantendo o resto de hoje", () => {
    const lst = [
      card({ id: "ontem", visita_em: "2026-09-06T10:00:00Z" }),
      card({ id: "cedo-hoje", visita_em: "2026-09-07T08:00:00Z" }),
      card({ id: "amanha", visita_em: "2026-09-08T10:00:00Z" }),
    ];
    expect(proximosCompromissos(lst, HOJE).map((k) => k.captacao.id)).toEqual(["cedo-hoje", "amanha"]);
  });
});

describe("agruparPorDia", () => {
  it("agrupa mantendo a ordem cronológica", () => {
    const lst = [
      card({ id: "a", visita_em: "2026-09-07T09:00:00Z" }),
      card({ id: "b", visita_em: "2026-09-07T15:00:00Z" }),
      card({ id: "c", visita_em: "2026-09-08T09:00:00Z" }),
    ];
    const dias = agruparPorDia(compromissos(lst));
    expect(dias.map((d) => d.dia)).toEqual(["2026-09-07", "2026-09-08"]);
    expect(dias[0].itens).toHaveLength(2);
  });
});

describe("rotuloDoDia", () => {
  it("hoje e amanhã ganham nome", () => {
    expect(rotuloDoDia(HOJE, HOJE)).toBe("Hoje");
    expect(rotuloDoDia("2026-09-08", HOJE)).toBe("Amanhã");
  });

  it("os demais viram data por extenso em pt-BR", () => {
    expect(rotuloDoDia("2026-09-15", HOJE)).toContain("setembro");
  });

  it("atravessa a virada do mês", () => {
    expect(rotuloDoDia("2026-10-01", "2026-09-30")).toBe("Amanhã");
  });
});

describe("fimDoCompromisso", () => {
  it("soma a duração ao início", () => {
    expect(fimDoCompromisso("2026-09-10T14:00:00.000Z", 60)).toBe("2026-09-10T15:00:00.000Z");
    expect(fimDoCompromisso("2026-09-10T14:00:00.000Z", 30)).toBe("2026-09-10T14:30:00.000Z");
  });
});
