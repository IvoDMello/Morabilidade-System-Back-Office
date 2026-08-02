import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dataSource } from "@/services/data";
import { mockStore } from "@/services/data/mock/store";
import { calcularPlacar } from "@/services/data/agent-proposal-score";
import type { DecisaoRegistrada } from "@/services/data/agent-proposal-score";

/**
 * Nível 1 do agente (pré-computar) + esteira de coleta de voz.
 *
 * O que estes testes protegem, em uma frase cada:
 *  - a mesma mensagem nunca é analisada duas vezes (a Meta reentrega webhooks);
 *  - numa rajada, só a última mensagem paga a chamada de modelo;
 *  - proposta velha não fica na tela depois que o assunto mudou;
 *  - editar uma resposta é registrado como `editada`, não como `aprovada` —
 *    é essa distinção que alimenta o aprendizado de voz.
 */

const TELEFONE = "5511970001234";

// A análise de verdade chama a API da Anthropic. Aqui só nos interessa o que o
// serviço faz ao redor dela, então o modelo é substituído por um retorno fixo.
const proporMock = vi.fn();
vi.mock("@/services/assistant", () => ({
  proporAcoesDaConversa: (contactId: string) => proporMock(contactId),
}));

const { analisarEGuardar, registrarConfirmacao, registrarDescarte } = await import(
  "@/services/agent-proposals.service"
);

function analiseComResposta(texto: string) {
  return {
    modelo: "modelo-de-teste",
    vozHash: "voz123",
    propostas: [
      {
        tool: "sugerir_resposta" as const,
        args: { contato_id: "x", texto },
        resumo: "Enviar resposta.",
      },
    ],
  };
}

/** Contato + conversa + uma mensagem recebida, como o webhook deixaria. */
async function prepararConversa() {
  const contato = await dataSource.contacts.create({
    name: "Proprietário Teste",
    phone: TELEFONE,
    category: "proprietario",
    status: "novo",
    nextAction: "ligar",
  });
  const conversa = await dataSource.whatsapp.getOrCreateConversationForContact(
    contato.id,
    TELEFONE,
  );
  const mensagem = await dataSource.whatsapp.createMessage({
    conversationId: conversa.id,
    direction: "inbound",
    body: "Tenho um apartamento pra alugar",
    status: "received",
    waTimestamp: new Date().toISOString(),
  });
  return { contato, conversa, mensagem };
}

beforeEach(() => {
  mockStore.agentProposals.length = 0;
  mockStore.contacts.length = 0;
  mockStore.conversations.length = 0;
  mockStore.messages.length = 0;
  proporMock.mockReset();
  proporMock.mockResolvedValue(analiseComResposta("Qual o endereço do imóvel?"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("analisarEGuardar", () => {
  it("guarda a proposta pendente para quem abrir a conversa depois", async () => {
    const { contato, mensagem } = await prepararConversa();

    const criadas = await analisarEGuardar({
      contactId: contato.id,
      triggerMessageId: mensagem.id,
      origem: "webhook",
    });

    expect(criadas).toHaveLength(1);
    expect(criadas[0].status).toBe("pendente");
    expect(criadas[0].textoSugerido).toBe("Qual o endereço do imóvel?");
    expect(criadas[0].origem).toBe("webhook");
    // Rastro de origem: sem isso não dá pra separar "modelo piorou" de "mexeram no VOZ.md".
    expect(criadas[0].modelo).toBe("modelo-de-teste");
    expect(criadas[0].vozHash).toBe("voz123");

    const pendentes = await dataSource.agentProposals.listPendentesPorContato(contato.id);
    expect(pendentes).toHaveLength(1);
  });

  it("não analisa a mesma mensagem duas vezes (reentrega da Meta)", async () => {
    const { contato, mensagem } = await prepararConversa();
    const entrada = {
      contactId: contato.id,
      triggerMessageId: mensagem.id,
      origem: "webhook" as const,
    };

    await analisarEGuardar(entrada);
    const segunda = await analisarEGuardar(entrada);

    expect(segunda).toHaveLength(0);
    expect(proporMock).toHaveBeenCalledTimes(1);
  });

  it("numa rajada, desiste da mensagem antiga e deixa a última analisar", async () => {
    const { contato, conversa, mensagem } = await prepararConversa();

    // O cliente mandou outra antes de a primeira ser analisada.
    await dataSource.whatsapp.createMessage({
      conversationId: conversa.id,
      direction: "inbound",
      body: "Fica na Rua das Flores, 100",
      status: "received",
      waTimestamp: new Date(Date.now() + 1000).toISOString(),
    });

    const criadas = await analisarEGuardar({
      contactId: contato.id,
      triggerMessageId: mensagem.id, // a antiga
      origem: "webhook",
    });

    expect(criadas).toHaveLength(0);
    expect(proporMock).not.toHaveBeenCalled();
  });

  it("marca as pendentes anteriores como superadas quando reanalisa", async () => {
    const { contato, mensagem } = await prepararConversa();
    await analisarEGuardar({
      contactId: contato.id,
      triggerMessageId: mensagem.id,
      origem: "webhook",
    });

    proporMock.mockResolvedValue(analiseComResposta("Quantos quartos tem?"));
    await analisarEGuardar({ contactId: contato.id, origem: "painel" });

    const pendentes = await dataSource.agentProposals.listPendentesPorContato(contato.id);
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].textoSugerido).toBe("Quantos quartos tem?");

    const superadas = mockStore.agentProposals.filter((p) => p.status === "superada");
    expect(superadas).toHaveLength(1);
  });
});

describe("registro do desfecho", () => {
  it("texto enviado igual ao sugerido conta como aprovada", async () => {
    const { contato, mensagem } = await prepararConversa();
    const [proposta] = await analisarEGuardar({
      contactId: contato.id,
      triggerMessageId: mensagem.id,
      origem: "webhook",
    });

    await registrarConfirmacao({
      propostaId: proposta.id,
      textoSugerido: "Qual o endereço do imóvel?",
      textoFinal: "Qual o endereço do imóvel?",
      decididoPor: "Ivo",
    });

    const salva = mockStore.agentProposals.find((p) => p.id === proposta.id);
    expect(salva?.status).toBe("aprovada");
    expect(salva?.decididoPor).toBe("Ivo");
  });

  it("texto reescrito conta como editada e guarda o par para o VOZ.md", async () => {
    const { contato, mensagem } = await prepararConversa();
    const [proposta] = await analisarEGuardar({
      contactId: contato.id,
      triggerMessageId: mensagem.id,
      origem: "webhook",
    });

    await registrarConfirmacao({
      propostaId: proposta.id,
      textoSugerido: "Qual o endereço do imóvel?",
      textoFinal: "Me passa o endereço completo, por favor",
      decididoPor: "Ivo",
    });

    const salva = mockStore.agentProposals.find((p) => p.id === proposta.id);
    expect(salva?.status).toBe("editada");

    const edicoes = await dataSource.agentProposals.listEdicoesRecentes();
    expect(edicoes).toHaveLength(1);
    expect(edicoes[0]).toMatchObject({
      sugerido: "Qual o endereço do imóvel?",
      enviado: "Me passa o endereço completo, por favor",
    });
  });

  it("diferença só de espaço em branco não conta como edição", async () => {
    const { contato, mensagem } = await prepararConversa();
    const [proposta] = await analisarEGuardar({
      contactId: contato.id,
      triggerMessageId: mensagem.id,
      origem: "webhook",
    });

    await registrarConfirmacao({
      propostaId: proposta.id,
      textoSugerido: "Qual o endereço do imóvel?",
      textoFinal: "  Qual o endereço do imóvel?  ",
    });

    expect(mockStore.agentProposals.find((p) => p.id === proposta.id)?.status).toBe("aprovada");
  });

  it("descartar é registrado como sinal", async () => {
    const { contato, mensagem } = await prepararConversa();
    const [proposta] = await analisarEGuardar({
      contactId: contato.id,
      triggerMessageId: mensagem.id,
      origem: "webhook",
    });

    await registrarDescarte(proposta.id, "Ivo");

    expect(mockStore.agentProposals.find((p) => p.id === proposta.id)?.status).toBe("descartada");
    expect(await dataSource.agentProposals.listPendentesPorContato(contato.id)).toHaveLength(0);
  });
});

describe("placar de graduação", () => {
  function decisao(
    status: DecisaoRegistrada["status"],
    minutosAtras: number,
  ): DecisaoRegistrada {
    return {
      tool: "sugerir_resposta",
      status,
      decididoEm: new Date(Date.now() - minutosAtras * 60_000).toISOString(),
    };
  }

  it("calcula a taxa de edição sobre as decisões", () => {
    const placar = calcularPlacar([
      decisao("aprovada", 50),
      decisao("aprovada", 40),
      decisao("editada", 30),
      decisao("descartada", 20),
    ]);
    const resposta = placar.find((s) => s.tool === "sugerir_resposta");

    expect(resposta?.decididas).toBe(4);
    expect(resposta?.taxaEdicao).toBeCloseTo(0.25);
  });

  it("a sequência limpa zera na primeira edição recente", () => {
    // Média boa (1 edição em 5), mas a última decisão foi uma edição: a
    // regressão precisa aparecer, senão promoveríamos um agente que piorou.
    const placar = calcularPlacar([
      decisao("aprovada", 50),
      decisao("aprovada", 40),
      decisao("aprovada", 30),
      decisao("aprovada", 20),
      decisao("editada", 5),
    ]);
    const resposta = placar.find((s) => s.tool === "sugerir_resposta");

    expect(resposta?.taxaEdicao).toBeCloseTo(0.2);
    expect(resposta?.sequenciaLimpa).toBe(0);
  });

  it("pendentes e superadas não entram no placar", () => {
    const placar = calcularPlacar([
      { tool: "criar_captacao", status: "pendente", decididoEm: null },
      { tool: "criar_captacao", status: "superada", decididoEm: null },
    ]);
    const captacao = placar.find((s) => s.tool === "criar_captacao");

    expect(captacao?.decididas).toBe(0);
    expect(captacao?.taxaEdicao).toBeNull();
  });
});
