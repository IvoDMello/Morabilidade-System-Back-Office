import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dataSource } from "@/services/data";
import { mockStore } from "@/services/data/mock/store";
import { estimarCustoUSD, PRECOS } from "@/lib/ai-pricing";
import { getModoAgente, permiteSugerirResposta } from "@/services/assistant/modo";
import { getModeloParaModo } from "@/lib/anthropic";
import {
  getGastoDoDia,
  getTetoTokensDia,
  mensagemMereceAnalise,
  dentroDoOrcamento,
  registrarUso,
} from "@/services/ai-budget.service";

/**
 * Controle de custo da IA.
 *
 * O que está sendo protegido: o papel do agente é organizacional, e o caminho
 * automático é o de alto volume. Cada guarda aqui existe para que o gasto seja
 * função de decisões nossas, não de quantas mensagens os clientes mandam.
 */

const ENV = {
  modo: process.env.AGENTE_MODO,
  chamadas: process.env.AI_MAX_CHAMADAS_HORA,
  tokens: process.env.AI_MAX_TOKENS_DIA,
  triagem: process.env.AI_MODEL_TRIAGEM,
};

beforeEach(() => {
  mockStore.agentRuns.length = 0;
});

afterEach(() => {
  for (const [chave, valor] of [
    ["AGENTE_MODO", ENV.modo],
    ["AI_MAX_CHAMADAS_HORA", ENV.chamadas],
    ["AI_MAX_TOKENS_DIA", ENV.tokens],
    ["AI_MODEL_TRIAGEM", ENV.triagem],
  ] as const) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
});

describe("papel do agente", () => {
  it("é organizacional por padrão — não redige para o cliente", () => {
    delete process.env.AGENTE_MODO;
    expect(getModoAgente()).toBe("organizacional");
    expect(permiteSugerirResposta("organizacional")).toBe(false);
  });

  it("valor inválido cai no modo restrito, nunca no permissivo", () => {
    process.env.AGENTE_MODO = "COMPLETAO";
    expect(getModoAgente()).toBe("organizacional");
  });

  it("só o modo completo libera texto para o cliente", () => {
    process.env.AGENTE_MODO = "completo";
    expect(getModoAgente()).toBe("completo");
    expect(permiteSugerirResposta("completo")).toBe(true);
  });
});

describe("escolha de modelo", () => {
  it("sem AI_MODEL_TRIAGEM nada muda sozinho: triagem usa o modelo padrão", () => {
    delete process.env.AI_MODEL_TRIAGEM;
    // Trocar de modelo é decisão de quem opera, não efeito de um deploy.
    expect(getModeloParaModo("organizacional")).toBe(getModeloParaModo("completo"));
  });

  it("Haiku custa um terço de Sonnet — a economia que justifica separar os dois", () => {
    const uso = { inputTokens: 1_000_000, outputTokens: 100_000 };
    const sonnet = estimarCustoUSD("claude-sonnet-5", uso)!;
    const haiku = estimarCustoUSD("claude-haiku-4-5", uso)!;
    expect(haiku).toBeCloseTo(sonnet / 3, 6);
  });
});

describe("estimativa de custo", () => {
  it("soma entrada e saída pelos preços do modelo", () => {
    // 1M de entrada a US$3 + 200k de saída a US$15 = 3 + 3 = US$6
    expect(estimarCustoUSD("claude-sonnet-5", { inputTokens: 1_000_000, outputTokens: 200_000 }))
      .toBeCloseTo(6, 6);
  });

  it("cache de leitura custa ~10% de uma entrada normal", () => {
    const normal = estimarCustoUSD("claude-sonnet-5", { inputTokens: 1_000_000, outputTokens: 0 })!;
    const cacheado = estimarCustoUSD("claude-sonnet-5", {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1_000_000,
    })!;
    expect(cacheado).toBeCloseTo(normal * 0.1, 6);
  });

  it("escrever no cache custa MAIS que entrada normal — cache não é grátis", () => {
    const normal = estimarCustoUSD("claude-sonnet-5", { inputTokens: 1_000_000, outputTokens: 0 })!;
    const escrita = estimarCustoUSD("claude-sonnet-5", {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 1_000_000,
    })!;
    expect(escrita).toBeCloseTo(normal * 1.25, 6);
  });

  it("modelo fora da tabela devolve null em vez de chutar", () => {
    // Custo inventado é pior que custo nenhum: alguém decidiria com base nele.
    expect(estimarCustoUSD("modelo-que-nao-existe", { inputTokens: 100, outputTokens: 10 }))
      .toBeNull();
    expect(Object.keys(PRECOS)).toContain("claude-sonnet-5");
  });
});

describe("guarda de conteúdo", () => {
  it("mensagem com dado de captação merece análise", () => {
    expect(mensagemMereceAnalise("tenho um apto na Rua Barata Ribeiro 200, 2 quartos")).toBe(true);
    expect(mensagemMereceAnalise("pode ser quinta às 15h?")).toBe(true);
  });

  it("confirmação curta não vira chamada de modelo", () => {
    // A chamada que não acontece é a mais barata de todas, e boa parte do
    // tráfego de WhatsApp é exatamente isto.
    for (const texto of ["ok", "Beleza", "obrigado!", "vlw", "bom dia", "👍", "sim"]) {
      expect(mensagemMereceAnalise(texto)).toBe(false);
    }
  });

  it("mídia sem legenda não tem o que organizar", () => {
    expect(mensagemMereceAnalise(null, "image")).toBe(false);
    expect(mensagemMereceAnalise("", "image")).toBe(false);
  });

  it("figurinha e áudio não chegam transcritos", () => {
    expect(mensagemMereceAnalise("[sticker]", "sticker")).toBe(false);
    expect(mensagemMereceAnalise("[audio]", "audio")).toBe(false);
  });

  it("na dúvida, analisa — pular uma captação custa mais que analisar à toa", () => {
    expect(mensagemMereceAnalise("oi, é sobre aquilo que conversamos")).toBe(true);
  });
});

describe("teto por tokens", () => {
  async function gastar(tokens: number) {
    await registrarUso({
      origem: "webhook",
      recurso: "copiloto-conversa",
      modelo: "claude-haiku-4-5",
      uso: { inputTokens: tokens, outputTokens: 0 },
    });
  }

  it("usa o padrão quando a variável não está definida", () => {
    delete process.env.AI_MAX_TOKENS_DIA;
    expect(getTetoTokensDia()).toBe(2_000_000);
  });

  it("barra por tokens mesmo com poucas chamadas", async () => {
    // Contar chamadas não limita gasto: uma análise sobre conversa longa custa
    // muitas vezes o que custa uma sobre três mensagens, e as duas contam "1".
    process.env.AI_MAX_CHAMADAS_HORA = "100";
    process.env.AI_MAX_TOKENS_DIA = "1000";
    await gastar(1200);

    const veredicto = await dentroDoOrcamento();
    expect(veredicto.liberado).toBe(false);
    expect(veredicto.motivo).toBe("tokens-dia");
  });

  it("tokens de cache entram na conta — leitura é barata, não é grátis", async () => {
    process.env.AI_MAX_TOKENS_DIA = "1000";
    await registrarUso({
      origem: "webhook",
      recurso: "copiloto-conversa",
      modelo: "claude-haiku-4-5",
      uso: { inputTokens: 100, outputTokens: 0, cacheReadTokens: 1500 },
    });

    expect((await dentroDoOrcamento()).liberado).toBe(false);
  });

  it("teto de tokens em 0 desliga o automático", async () => {
    process.env.AI_MAX_TOKENS_DIA = "0";
    expect((await dentroDoOrcamento()).motivo).toBe("desligado");
  });
});

describe("gasto do dia", () => {
  it("converte tokens em dólares por modelo", async () => {
    await registrarUso({
      origem: "webhook",
      recurso: "copiloto-conversa",
      modelo: "claude-haiku-4-5",
      uso: { inputTokens: 1_000_000, outputTokens: 200_000 },
    });

    const gasto = await getGastoDoDia();
    expect(gasto.chamadas).toBe(1);
    expect(gasto.tokens).toBe(1_200_000);
    // 1M entrada a US$1 + 200k saída a US$5 = 1 + 1 = US$2
    expect(gasto.custoUSD).toBeCloseTo(2, 6);
  });

  it("um modelo fora da tabela invalida o total em vez de subestimá-lo", async () => {
    await registrarUso({
      origem: "webhook", recurso: "x", modelo: "claude-haiku-4-5",
      uso: { inputTokens: 1000, outputTokens: 100 },
    });
    await registrarUso({
      origem: "painel", recurso: "x", modelo: "modelo-desconhecido",
      uso: { inputTokens: 1000, outputTokens: 100 },
    });

    const gasto = await getGastoDoDia();
    expect(gasto.chamadas).toBe(2);
    expect(gasto.custoUSD).toBeNull();
  });

  it("o painel entra no gasto total, mesmo não contando para o teto", async () => {
    // O teto protege o automático; a contabilidade precisa ver tudo.
    await registrarUso({
      origem: "painel", recurso: "copiloto-conversa", modelo: "claude-sonnet-5",
      uso: { inputTokens: 1000, outputTokens: 100 },
    });

    expect((await getGastoDoDia()).chamadas).toBe(1);
    expect((await dentroDoOrcamento()).usadas).toBe(0);
  });
});

describe("livro-razão", () => {
  it("guarda o modo de cada chamada, para separar triagem de análise completa", async () => {
    await registrarUso({
      origem: "webhook", recurso: "copiloto-conversa", modelo: "claude-haiku-4-5",
      modo: "organizacional", uso: { inputTokens: 500, outputTokens: 50 },
    });

    const [run] = await dataSource.agentRuns.listRecentes(1);
    expect(run.modo).toBe("organizacional");
  });
});
