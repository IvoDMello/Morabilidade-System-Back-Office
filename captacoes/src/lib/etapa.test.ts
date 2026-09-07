import { describe, it, expect } from "vitest";
import { etapaDaCaptacao, engavetadaSemDecisao, foiGravada, pendenciaDaCaptacao } from "./etapa";
import type { Captacao } from "@/types";

function card(p: Partial<Captacao>): Captacao {
  return {
    id: "c1",
    endereco: "",
    status: "novas",
    ordem: 0,
    decisao: null,
    visita_concluida: false,
    visita_data: null,
    visita_em: null,
    gravacao_concluida: false,
    gravacao_data: null,
    gravacao_em: null,
    ...p,
  } as Captacao;
}

describe("etapaDaCaptacao", () => {
  it("as três colunas de entrada viram a aba Decidir", () => {
    expect(etapaDaCaptacao(card({ status: "aguardando_informacoes" }))).toBe("decidir");
    expect(etapaDaCaptacao(card({ status: "novas" }))).toBe("decidir");
    expect(etapaDaCaptacao(card({ status: "em_decisao" }))).toBe("decidir");
  });

  it("o ramo aprovado vira a aba Aprovadas", () => {
    expect(etapaDaCaptacao(card({ status: "pendente_agendar_visita" }))).toBe("aprovada");
    expect(etapaDaCaptacao(card({ status: "pendente_agendar_gravacao" }))).toBe("aprovada");
  });

  it("pendente de negativa e negativada são a MESMA etapa", () => {
    expect(etapaDaCaptacao(card({ status: "pendente_negativa" }))).toBe("negativada");
    expect(etapaDaCaptacao(card({ status: "negativada" }))).toBe("negativada");
  });

  it("publicada tem etapa própria", () => {
    expect(etapaDaCaptacao(card({ status: "publicada" }))).toBe("publicada");
  });

  it("gaveta e seleção especial herdam a etapa da decisão registrada", () => {
    expect(etapaDaCaptacao(card({ status: "gaveta", decisao: "aprovada" }))).toBe("aprovada");
    expect(etapaDaCaptacao(card({ status: "gaveta", decisao: "reprovada" }))).toBe("negativada");
    expect(etapaDaCaptacao(card({ status: "selecao_especial", decisao: "aprovada" }))).toBe("aprovada");
  });

  it("engavetada sem decisão volta para Decidir", () => {
    expect(etapaDaCaptacao(card({ status: "gaveta", decisao: null }))).toBe("decidir");
    expect(etapaDaCaptacao(card({ status: "selecao_especial", decisao: null }))).toBe("decidir");
  });
});

describe("engavetadaSemDecisao", () => {
  it("marca só gaveta/seleção especial ainda sem decisão", () => {
    expect(engavetadaSemDecisao(card({ status: "gaveta", decisao: null }))).toBe(true);
    expect(engavetadaSemDecisao(card({ status: "selecao_especial", decisao: null }))).toBe(true);
    expect(engavetadaSemDecisao(card({ status: "gaveta", decisao: "aprovada" }))).toBe(false);
    expect(engavetadaSemDecisao(card({ status: "novas", decisao: null }))).toBe(false);
  });
});

describe("pendenciaDaCaptacao", () => {
  it("aprovada sem nada agendado pede visita", () => {
    const c = card({ status: "pendente_agendar_visita", decisao: "aprovada" });
    expect(pendenciaDaCaptacao(c)).toBe("agendar_visita");
  });

  it("com visita marcada, passa a pedir gravação", () => {
    const c = card({ status: "pendente_agendar_visita", decisao: "aprovada", visita_data: "2026-09-10" });
    expect(pendenciaDaCaptacao(c)).toBe("agendar_gravacao");
  });

  it("visita com hora também conta como agendada", () => {
    const c = card({
      status: "pendente_agendar_visita",
      decisao: "aprovada",
      visita_em: "2026-09-10T14:00:00Z",
    });
    expect(pendenciaDaCaptacao(c)).toBe("agendar_gravacao");
  });

  it("com as duas marcadas, não sobra pendência", () => {
    const c = card({
      status: "pendente_agendar_gravacao",
      decisao: "aprovada",
      visita_data: "2026-09-10",
      gravacao_data: "2026-09-11",
    });
    expect(pendenciaDaCaptacao(c)).toBeNull();
  });

  it("quem não está aprovada não tem pendência de agendamento", () => {
    expect(pendenciaDaCaptacao(card({ status: "novas" }))).toBeNull();
    expect(pendenciaDaCaptacao(card({ status: "pendente_negativa" }))).toBeNull();
  });
});

describe("foiGravada", () => {
  it("exige a marca de concluída E uma data", () => {
    expect(foiGravada(card({ gravacao_concluida: true, gravacao_data: "2026-09-02" }))).toBe(true);
    expect(foiGravada(card({ gravacao_concluida: true, gravacao_em: "2026-09-02T10:00:00Z" }))).toBe(true);
    expect(foiGravada(card({ gravacao_concluida: true }))).toBe(false);
    expect(foiGravada(card({ gravacao_data: "2026-09-02" }))).toBe(false);
  });
});
