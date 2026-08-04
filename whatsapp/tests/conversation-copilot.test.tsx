// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ConversationCopilot } from "@/features/assistant/components/conversation-copilot";
import type { AgentProposal } from "@/types/agent-proposal";

const analisarConversaAction = vi.fn();
const executarAcaoDaConversaAction = vi.fn();
const dispensarPropostaAction = vi.fn();
const registrarCaptacaoEncaminhadaAction = vi.fn();

vi.mock("@/app/conversas/copilot-actions", () => ({
  analisarConversaAction: (...a: unknown[]) => analisarConversaAction(...a),
  executarAcaoDaConversaAction: (...a: unknown[]) => executarAcaoDaConversaAction(...a),
  dispensarPropostaAction: (...a: unknown[]) => dispensarPropostaAction(...a),
  registrarCaptacaoEncaminhadaAction: (...a: unknown[]) => registrarCaptacaoEncaminhadaAction(...a),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function proposta(over: Partial<AgentProposal> = {}): AgentProposal {
  return {
    id: "prop-1",
    conversationId: "conv-1",
    contactId: "contato-1",
    triggerMessageId: null,
    tool: "sugerir_resposta",
    args: { contato_id: "contato-1", texto: "Oi Ana, o imóvel segue disponível!" },
    resumo: "Responder à Ana sobre disponibilidade",
    status: "pendente",
    textoSugerido: "Oi Ana, o imóvel segue disponível!",
    textoFinal: null,
    decididoPor: null,
    decididoEm: null,
    modelo: "claude",
    vozHash: null,
    origem: "webhook",
    createdAt: "2026-08-02T12:00:00Z",
    ...over,
  };
}

function abrir(propostas: AgentProposal[], captacoesUrl: string | null = null) {
  render(
    <ConversationCopilot
      contactId="contato-1"
      contactName="Ana Prado"
      contactPhone="5521999990000"
      captacoesContato={[]}
      captacoesRecentes={[]}
      captacoesUrl={captacoesUrl}
      propostasPendentes={propostas}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Copiloto/ }));
}

/**
 * O copiloto é onde a proposta vira mensagem para um cliente de verdade.
 * O que importa travar: o texto que sai é o que está na tela no momento do
 * clique, e o texto original vai junto para o servidor saber se houve edição —
 * é essa diferença que ensina a voz da casa ao agente.
 */
describe("Copiloto da conversa", () => {
  beforeEach(() => {
    analisarConversaAction.mockReset();
    executarAcaoDaConversaAction.mockReset();
    dispensarPropostaAction.mockReset();
    registrarCaptacaoEncaminhadaAction.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("já abre com o que o agente adiantou, sem precisar clicar em analisar", async () => {
    abrir([proposta()]);
    expect(await screen.findByText("Responder à Ana sobre disponibilidade")).toBeInTheDocument();
    expect(analisarConversaAction).not.toHaveBeenCalled();
  });

  it("envia o texto editado e leva o original junto para medir a edição", async () => {
    executarAcaoDaConversaAction.mockResolvedValue({ ok: true, message: "Mensagem enviada." });
    abrir([proposta()]);

    const caixa = await screen.findByLabelText("Texto da resposta sugerida");
    fireEvent.change(caixa, { target: { value: "Oi Ana! Segue disponível sim 🙂" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar resposta/ }));

    await waitFor(() =>
      expect(executarAcaoDaConversaAction).toHaveBeenCalledWith(
        "contato-1",
        "sugerir_resposta",
        { contato_id: "contato-1", texto: "Oi Ana! Segue disponível sim 🙂" },
        "prop-1",
        "Oi Ana, o imóvel segue disponível!",
      ),
    );
    expect(await screen.findByText(/Mensagem enviada\./)).toBeInTheDocument();
  });

  it("mostra os campos de uma captação proposta antes de gravar", async () => {
    abrir([
      proposta({
        id: "prop-2",
        tool: "criar_captacao",
        args: { endereco: "Rua das Acácias 120", quartos: 3, tipo_portaria: "24h" },
        resumo: "Criar captação da Rua das Acácias",
        textoSugerido: null,
      }),
    ]);

    expect(await screen.findByText("Rua das Acácias 120")).toBeInTheDocument();
    expect(screen.getByText("tipo portaria")).toBeInTheDocument();
    // Sem caixa de texto: só sugerir_resposta é editável.
    expect(screen.queryByLabelText("Texto da resposta sugerida")).not.toBeInTheDocument();
  });

  it("dispensar tira o cartão da tela e registra o descarte como treino", async () => {
    abrir([proposta()]);
    fireEvent.click(await screen.findByRole("button", { name: "Dispensar" }));

    expect(dispensarPropostaAction).toHaveBeenCalledWith("prop-1");
    await waitFor(() =>
      expect(screen.queryByText("Responder à Ana sobre disponibilidade")).not.toBeInTheDocument(),
    );
  });

  it("reanalisar substitui as propostas na tela", async () => {
    analisarConversaAction.mockResolvedValue({
      ok: true,
      propostas: [proposta({ id: "prop-9", resumo: "Agendar visita para sábado", tool: "agendar_visita", args: { data_hora: "2026-08-08T10:00" } })],
    });
    abrir([proposta()]);

    fireEvent.click(await screen.findByRole("button", { name: /Analisar conversa/ }));
    expect(await screen.findByText("Agendar visita para sábado")).toBeInTheDocument();
    expect(screen.queryByText("Responder à Ana sobre disponibilidade")).not.toBeInTheDocument();
  });

  /**
   * A regra que este bloco protege: o CRM não cria captação. Ele leva o
   * rascunho para o formulário completo do board — que é onde estão os campos
   * obrigatórios e a checagem de duplicadas. Antes, o botão gravava direto e
   * nascia cartão pela metade.
   */
  it("o rascunho manual abre o formulário do board com o que foi digitado", async () => {
    const open = vi.fn<(url?: string, target?: string, features?: string) => null>(() => null);
    vi.stubGlobal("open", open);

    abrir([], "https://captacoes.morabilidade.com");
    fireEvent.click(screen.getByRole("button", { name: /Nova captação/ }));
    fireEvent.change(screen.getByLabelText(/Endereço/), {
      target: { value: "Rua Albert Sabin, 10" },
    });
    fireEvent.change(screen.getByLabelText(/Quartos/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Completar no board/ }));

    expect(open).toHaveBeenCalledTimes(1);
    const url = new URL(open.mock.calls[0][0]!);
    expect(url.origin + url.pathname).toBe("https://captacoes.morabilidade.com/board");
    expect(url.searchParams.get("nova")).toBe("1");
    expect(url.searchParams.get("endereco")).toBe("Rua Albert Sabin, 10");
    expect(url.searchParams.get("quartos")).toBe("5");
    // O contato da conversa vai como proprietário, sem ninguém redigitar.
    expect(url.searchParams.get("proprietario_nome")).toBe("Ana Prado");
    expect(url.searchParams.get("whatsapp")).toBe("5521999990000");
  });

  it("confirmar a proposta de captação abre o board em vez de gravar", async () => {
    const open = vi.fn<(url?: string, target?: string, features?: string) => null>(() => null);
    vi.stubGlobal("open", open);

    abrir(
      [
        proposta({
          id: "prop-2",
          tool: "criar_captacao",
          args: { endereco: "Rua das Acácias 120", quartos: 3, tipo_portaria: "24h" },
          resumo: "Criar captação da Rua das Acácias",
          textoSugerido: null,
        }),
      ],
      "https://captacoes.morabilidade.com",
    );

    fireEvent.click(await screen.findByRole("button", { name: /Confirmar/ }));

    // Nada é executado no servidor — o cartão nasce no board.
    expect(executarAcaoDaConversaAction).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
    const url = new URL(open.mock.calls[0][0]!);
    expect(url.searchParams.get("endereco")).toBe("Rua das Acácias 120");
    expect(url.searchParams.get("tipo_portaria")).toBe("24h");
    // O desfecho ainda é registrado: é o sinal de treino do agente.
    expect(registrarCaptacaoEncaminhadaAction).toHaveBeenCalledWith("prop-2");
  });

  it("sem board configurado, o rascunho não tem para onde ir", async () => {
    abrir([], null);
    fireEvent.click(screen.getByRole("button", { name: /Nova captação/ }));
    fireEvent.change(screen.getByLabelText(/Endereço/), { target: { value: "Rua X, 1" } });

    expect(screen.getByRole("button", { name: /Completar no board/ })).toBeDisabled();
    expect(screen.getByText(/CAPTACOES_BOARD_URL/)).toBeInTheDocument();
  });

  it("avisa quando a IA não sugere nada", async () => {
    analisarConversaAction.mockResolvedValue({ ok: true, propostas: [] });
    abrir([]);

    fireEvent.click(await screen.findByRole("button", { name: /Analisar conversa/ }));
    expect(await screen.findByText("Nenhuma ação sugerida.")).toBeInTheDocument();
  });
});
