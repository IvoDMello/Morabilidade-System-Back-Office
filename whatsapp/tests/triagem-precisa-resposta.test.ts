import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { triagemVencida } from "@/services/ai.service";
import { runTriagemJob } from "@/services/jobs.service";
import { getPendingQueue } from "@/services/whatsapp.service";
import { dataSource } from "@/services/data";
import { mockStore } from "@/services/data/mock/store";

/**
 * A aba "Precisa responder": a fila de `aguardando_resposta` é mecânica (a
 * última mensagem foi do cliente) e mistura "consegue visitar sábado?" com
 * "obrigada!". A triagem da IA separa as duas coisas e grava o resultado na
 * conversa — o que estes testes cobrem é a regra em volta da IA, não a IA:
 * quando reanalisar, o que entra na fila e o que fazer quando ela não roda.
 */

const BASE = {
  lastMessageAt: "2026-08-10T12:00:00Z",
  triagemPrecisaResposta: null as boolean | null,
  triagemMensagemEm: null as string | null,
};

describe("quando a triagem precisa ser refeita", () => {
  it("conversa nunca triada sempre entra na rodada", () => {
    expect(triagemVencida(BASE)).toBe(true);
  });

  it("conversa já triada e parada desde então não é reanalisada", () => {
    expect(
      triagemVencida({
        ...BASE,
        triagemPrecisaResposta: true,
        triagemMensagemEm: "2026-08-10T12:00:00Z",
      }),
    ).toBe(false);
  });

  it("conversa que andou depois da triagem volta para a fila de análise", () => {
    expect(
      triagemVencida({
        ...BASE,
        lastMessageAt: "2026-08-10T18:00:00Z",
        triagemPrecisaResposta: false,
        triagemMensagemEm: "2026-08-10T12:00:00Z",
      }),
    ).toBe(true);
  });
});

describe("a fila do painel", () => {
  beforeEach(async () => {
    // Zera a triagem de todo mundo — outros testes mexem no mesmo store.
    for (const conversa of mockStore.conversations) {
      conversa.triagemPrecisaResposta = null;
      conversa.triagemMotivo = null;
      conversa.triagemMensagemEm = null;
    }
  });

  async function umaConversaAguardando() {
    const conversas = mockStore.conversations.filter((c) => c.status === "aguardando_resposta");
    expect(conversas.length).toBeGreaterThan(0);
    return conversas[0];
  }

  it("não promove conversa sem triagem — silêncio não é diagnóstico", async () => {
    const queue = await getPendingQueue();
    expect(queue.aguardandoResposta.length).toBeGreaterThan(0);
    expect(queue.precisaResposta).toEqual([]);
  });

  it("traz para a aba só o que a IA marcou como precisando de resposta", async () => {
    const conversa = await umaConversaAguardando();
    await dataSource.whatsapp.salvarTriagem(conversa.id, {
      precisaResposta: true,
      motivo: "perguntou o valor e não foi respondido",
      mensagemEm: conversa.lastMessageAt,
    });

    const queue = await getPendingQueue();
    const ids = queue.precisaResposta.map((c) => c.id);
    expect(ids).toContain(conversa.id);
    expect(queue.precisaResposta[0].triagemMotivo).toBe(
      "perguntou o valor e não foi respondido",
    );
  });

  it("deixa fora o que a IA marcou como encerramento, sem tirar de Aguardando", async () => {
    const conversa = await umaConversaAguardando();
    await dataSource.whatsapp.salvarTriagem(conversa.id, {
      precisaResposta: false,
      motivo: "agradeceu e encerrou",
      mensagemEm: conversa.lastMessageAt,
    });

    const queue = await getPendingQueue();
    expect(queue.precisaResposta.map((c) => c.id)).not.toContain(conversa.id);
    // A fila crua continua completa: a triagem é uma leitura, não um veredito
    // que apaga conversa da tela.
    expect(queue.aguardandoResposta.map((c) => c.id)).toContain(conversa.id);
  });
});

describe("o job horário", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sem chave da IA, não marca ninguém e diz por quê", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const resultado = await runTriagemJob();

    // Nenhuma conversa é tocada: a triagem que não rodou tem de continuar
    // parecendo o que é — ausência de leitura, não "não precisa de resposta".
    expect(resultado.triadas).toBe(0);
    expect(resultado.skippedReason).toBe("ANTHROPIC_API_KEY não configurada");
    const queue = await getPendingQueue();
    expect(queue.precisaResposta).toEqual([]);
  });
});
