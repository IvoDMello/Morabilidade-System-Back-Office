import { beforeEach, describe, expect, it } from "vitest";
import { mockStore } from "@/services/data/mock/store";
import { classificarRecusa, MOTIVO_RECUSA_ACAO } from "@/lib/webhook-diagnostico";
import {
  getFalhasDeEntrega,
  registrarEntregaProblematica,
} from "@/services/webhook-log.service";

/**
 * Mensagens perdidas ANTES de entrar no sistema.
 *
 * Uma assinatura que não confere devolvia 401 e pronto: a Meta reentregava
 * algumas vezes, desistia, e a mensagem do cliente nunca tinha existido para o
 * sistema — sem log, sem alerta, sem linha em lugar nenhum.
 */

const ASSINATURA = "sha256=abc123";

beforeEach(() => {
  mockStore.webhookDeliveries.length = 0;
});

describe("classificação da recusa", () => {
  it("separa 'falta a env' de 'segredo errado'", () => {
    // Duas causas, mesmo sintoma, ações completamente diferentes.
    expect(
      classificarRecusa({ temSegredoConfigurado: false, cabecalhoAssinatura: ASSINATURA }),
    ).toBe("sem_segredo");

    expect(
      classificarRecusa({ temSegredoConfigurado: true, cabecalhoAssinatura: ASSINATURA }),
    ).toBe("assinatura_invalida");
  });

  it("requisição sem assinatura não é registrada", () => {
    // O endereço do webhook é público e recebe varredura de internet. Registrar
    // isso transformaria o livro num log de scanner e destruiria a invariante
    // que o torna útil: toda linha é uma perda real.
    expect(
      classificarRecusa({ temSegredoConfigurado: true, cabecalhoAssinatura: null }),
    ).toBeNull();
    expect(
      classificarRecusa({ temSegredoConfigurado: true, cabecalhoAssinatura: "Bearer xyz" }),
    ).toBeNull();
  });

  it("cada motivo tem uma ação escrita para quem opera", () => {
    for (const motivo of ["sem_segredo", "assinatura_invalida", "erro_processamento"] as const) {
      expect(MOTIVO_RECUSA_ACAO[motivo]).toBeTruthy();
    }
    // O caso mais provável precisa dizer o nome da variável.
    expect(MOTIVO_RECUSA_ACAO.sem_segredo).toContain("WHATSAPP_APP_SECRET");
  });
});

describe("livro de entregas recusadas", () => {
  it("agrupa por motivo e guarda desde quando está quebrado", async () => {
    await registrarEntregaProblematica({ motivo: "sem_segredo" });
    await registrarEntregaProblematica({ motivo: "sem_segredo" });
    await registrarEntregaProblematica({ motivo: "sem_segredo" });

    const [falha] = await getFalhasDeEntrega();
    expect(falha.motivo).toBe("sem_segredo");
    expect(falha.ocorrencias).toBe(3);
    // `desde` é o que diz o tamanho do estrago — uma lista crua de 3 linhas
    // iguais esconderia justamente isso.
    expect(falha.desde).toBeTruthy();
  });

  it("problema de configuração aparece antes de erro de processamento", async () => {
    await registrarEntregaProblematica({ motivo: "erro_processamento", eventos: 1 });
    await registrarEntregaProblematica({ motivo: "sem_segredo" });

    // Rejeita 100% das mensagens e a correção é uma env, não uma investigação.
    expect((await getFalhasDeEntrega()).map((f) => f.motivo)).toEqual([
      "sem_segredo",
      "erro_processamento",
    ]);
  });

  it("guarda os wamids de quem falhou, para cruzar com o celular", async () => {
    await registrarEntregaProblematica({
      motivo: "erro_processamento",
      eventos: 3,
      processados: 2,
      wamids: ["wamid.perdida"],
      erro: "banco fora do ar",
    });

    expect(mockStore.webhookDeliveries[0]).toMatchObject({
      eventos: 3,
      processados: 2,
      wamids: ["wamid.perdida"],
    });
  });

  it("tabela vazia é sistema saudável — nada a mostrar", async () => {
    expect(await getFalhasDeEntrega()).toEqual([]);
  });

  it("ignora falha mais velha que a janela de 7 dias", async () => {
    await registrarEntregaProblematica({ motivo: "sem_segredo" });
    mockStore.webhookDeliveries[0].createdAt = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000,
    ).toISOString();

    expect(await getFalhasDeEntrega()).toEqual([]);
  });

  it("registrar nunca lança — é o caminho de erro do webhook", async () => {
    const original = mockStore.webhookDeliveries;
    // Simula a migration 0022 não aplicada.
    Object.defineProperty(mockStore, "webhookDeliveries", {
      get() {
        throw new Error("relation whatsapp.webhook_deliveries does not exist");
      },
      configurable: true,
    });

    try {
      // Falhar ao anotar o erro não pode virar um segundo erro.
      await expect(
        registrarEntregaProblematica({ motivo: "sem_segredo" }),
      ).resolves.toBeUndefined();
      expect(await getFalhasDeEntrega()).toEqual([]);
    } finally {
      Object.defineProperty(mockStore, "webhookDeliveries", {
        value: original,
        writable: true,
        configurable: true,
      });
    }
  });
});
