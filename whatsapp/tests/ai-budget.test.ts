import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dataSource } from "@/services/data";
import { mockStore } from "@/services/data/mock/store";
import {
  dentroDoOrcamento,
  getTetoPorHora,
  registrarUso,
} from "@/services/ai-budget.service";

/**
 * Teto de gasto do caminho automático da IA.
 *
 * O que está sendo protegido: desde que a análise virou automática, o gatilho de
 * custo passou a ser o cliente digitando. O teto contém rajada e loop de
 * reentrega — sem nunca barrar quem clicou no painel.
 */

const TETO_ORIGINAL = process.env.AI_MAX_CHAMADAS_HORA;

async function registrarChamadas(n: number, origem: "webhook" | "painel" = "webhook") {
  for (let i = 0; i < n; i++) {
    await registrarUso({
      origem,
      recurso: "copiloto-conversa",
      modelo: "claude-sonnet-5",
      uso: { inputTokens: 1000, outputTokens: 100 },
    });
  }
}

beforeEach(() => {
  mockStore.agentRuns.length = 0;
});

afterEach(() => {
  if (TETO_ORIGINAL === undefined) delete process.env.AI_MAX_CHAMADAS_HORA;
  else process.env.AI_MAX_CHAMADAS_HORA = TETO_ORIGINAL;
});

describe("leitura do teto", () => {
  it("usa o padrão quando a variável não está definida", () => {
    delete process.env.AI_MAX_CHAMADAS_HORA;
    expect(getTetoPorHora()).toBe(60);
  });

  it("aceita o valor do ambiente", () => {
    process.env.AI_MAX_CHAMADAS_HORA = "5";
    expect(getTetoPorHora()).toBe(5);
  });

  it("valor inválido no painel de env cai no padrão, nunca em 'sem teto'", () => {
    process.env.AI_MAX_CHAMADAS_HORA = "abc";
    expect(getTetoPorHora()).toBe(60);
    process.env.AI_MAX_CHAMADAS_HORA = "-3";
    expect(getTetoPorHora()).toBe(60);
  });

  it("string vazia (variável declarada e sem valor) cai no padrão", () => {
    process.env.AI_MAX_CHAMADAS_HORA = "";
    expect(getTetoPorHora()).toBe(60);
  });
});

describe("decisão de orçamento", () => {
  it("libera enquanto está abaixo do teto", async () => {
    process.env.AI_MAX_CHAMADAS_HORA = "3";
    await registrarChamadas(2);

    const veredicto = await dentroDoOrcamento();
    expect(veredicto.liberado).toBe(true);
    expect(veredicto.usadas).toBe(2);
    expect(veredicto.teto).toBe(3);
  });

  it("barra ao atingir o teto", async () => {
    process.env.AI_MAX_CHAMADAS_HORA = "3";
    await registrarChamadas(3);

    expect((await dentroDoOrcamento()).liberado).toBe(false);
  });

  it("clique de painel não consome o orçamento do automático", async () => {
    process.env.AI_MAX_CHAMADAS_HORA = "2";
    await registrarChamadas(5, "painel");

    const veredicto = await dentroDoOrcamento();
    expect(veredicto.usadas).toBe(0);
    expect(veredicto.liberado).toBe(true);
  });

  it("teto 0 desliga a análise automática — a válvula sem redeploy", async () => {
    process.env.AI_MAX_CHAMADAS_HORA = "0";
    expect((await dentroDoOrcamento()).liberado).toBe(false);
  });

  it("chamada de mais de uma hora atrás não conta (janela deslizante)", async () => {
    process.env.AI_MAX_CHAMADAS_HORA = "1";
    await registrarChamadas(1);
    // Empurra a chamada para 2h atrás: um pico de manhã não pode deixar a
    // operação sem copiloto à tarde.
    mockStore.agentRuns[0].createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const veredicto = await dentroDoOrcamento();
    expect(veredicto.usadas).toBe(0);
    expect(veredicto.liberado).toBe(true);
  });

  it("falha aberta: sem conseguir apurar o consumo, libera", async () => {
    process.env.AI_MAX_CHAMADAS_HORA = "1";
    const original = dataSource.agentRuns.consumoAutomaticoDesde;
    dataSource.agentRuns.consumoAutomaticoDesde = async () => {
      throw new Error("tabela agent_runs ausente (migration 0021 não rodou)");
    };

    try {
      // O teto existe para conter excesso; negar o recurso principal por causa
      // de uma consulta de contabilidade seria trocar um problema por outro.
      expect((await dentroDoOrcamento()).liberado).toBe(true);
    } finally {
      dataSource.agentRuns.consumoAutomaticoDesde = original;
    }
  });
});

describe("livro-razão", () => {
  it("guarda os tokens de cada chamada", async () => {
    await registrarChamadas(2);
    const consumo = await dataSource.agentRuns.consumoAutomaticoDesde(
      new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    );
    expect(consumo).toEqual({ chamadas: 2, inputTokens: 2000, outputTokens: 200 });
  });

  it("registrar nunca lança, mesmo com a escrita falhando", async () => {
    const original = dataSource.agentRuns.registrar;
    dataSource.agentRuns.registrar = async () => {
      throw new Error("banco fora");
    };
    try {
      // O gasto já aconteceu; falhar o registro não pode desfazer o resultado
      // que o usuário está esperando.
      await expect(
        registrarUso({ origem: "webhook", recurso: "x", modelo: "m" }),
      ).resolves.toBeUndefined();
    } finally {
      dataSource.agentRuns.registrar = original;
    }
  });
});
