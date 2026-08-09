// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import { ProposalCard } from "@/features/assistant/components/proposal-card";
import { AssistantConsole } from "@/features/assistant/components/assistant-console";

expect.extend(toHaveNoViolations);

const proporAcoesAction = vi.fn();
const executarAcaoAction = vi.fn();

vi.mock("@/app/assistente/actions", () => ({
  proporAcoesAction: (...a: unknown[]) => proporAcoesAction(...a),
  executarAcaoAction: (...a: unknown[]) => executarAcaoAction(...a),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const VISITA = {
  tool: "agendar_visita" as const,
  args: { contato_id: "c1", titulo: "Visita", data_hora: "2026-08-03T15:00", imovel_codigo: "MB-00033" },
  resumo: "Agendar visita com Marcos amanhã às 15h",
};

const RESPOSTA = {
  tool: "sugerir_resposta" as const,
  args: { contato_id: "c1", texto: "Oi Marcos, tudo bem?" },
  resumo: "Responder ao Marcos",
};

/**
 * O cartão de confirmação é o último ponto antes de algo virar realidade —
 * criar captação, agendar visita, mandar mensagem para um cliente. Estes
 * testes fixam as duas garantias que ele precisa dar: mostrar o que será
 * gravado e devolver exatamente o texto que está na tela.
 */
describe("Cartão de proposta da IA", () => {
  afterEach(cleanup);

  it("não tem violações de acessibilidade (jest-axe)", async () => {
    const { container } = render(
      <ProposalCard
        proposta={VISITA}
        status={{ kind: "pending" }}
        isExecuting={false}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("mostra os campos que serão gravados, não só o resumo", () => {
    render(
      <ProposalCard
        proposta={VISITA}
        status={{ kind: "pending" }}
        isExecuting={false}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    // Uma data mal interpretada pelo modelo só aparece se os args estiverem à vista.
    expect(screen.getByText("2026-08-03T15:00")).toBeInTheDocument();
    expect(screen.getByText("MB-00033")).toBeInTheDocument();
    expect(screen.getByText("data hora")).toBeInTheDocument();
  });

  it("confirma ações comuns sem texto final", () => {
    const onConfirm = vi.fn();
    render(
      <ProposalCard
        proposta={VISITA}
        status={{ kind: "pending" }}
        isExecuting={false}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Confirmar/ }));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it("devolve o texto editado da resposta sugerida", () => {
    const onConfirm = vi.fn();
    render(
      <ProposalCard
        proposta={RESPOSTA}
        status={{ kind: "pending" }}
        isExecuting={false}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    );
    const caixa = screen.getByLabelText("Texto da resposta sugerida");
    expect(caixa).toHaveValue("Oi Marcos, tudo bem?");
    fireEvent.change(caixa, { target: { value: "Oi Marcos! Tudo certo por aí?" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar resposta/ }));
    expect(onConfirm).toHaveBeenCalledWith("Oi Marcos! Tudo certo por aí?");
  });

  it("some com as ações depois de executada e mostra o resultado", () => {
    render(
      <ProposalCard
        proposta={VISITA}
        status={{ kind: "done", message: "Visita agendada." }}
        isExecuting={false}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/Visita agendada\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dispensar" })).not.toBeInTheDocument();
  });

  it("deixa tentar de novo quando a execução falhou", () => {
    render(
      <ProposalCard
        proposta={VISITA}
        status={{ kind: "error", message: "Contato não encontrado." }}
        isExecuting={false}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Contato não encontrado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmar/ })).toBeInTheDocument();
  });
});

/** O console do /assistente usava um cartão próprio que só mostrava o resumo:
 * dava para confirmar sem ver a data que o modelo entendeu. Agora usa o mesmo
 * cartão do copiloto — este teste é a trava contra a divergência voltar. */
describe("Console do /assistente usa o cartão compartilhado", () => {
  beforeEach(() => {
    proporAcoesAction.mockReset();
    executarAcaoAction.mockReset();
  });
  afterEach(cleanup);

  it("mostra os campos propostos antes da confirmação", async () => {
    proporAcoesAction.mockResolvedValue({ ok: true, propostas: [VISITA] });

    render(<AssistantConsole captacoesUrl="https://captacoes.morabilidade.com" />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "agendar visita com o Marcos amanhã 15h" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Analisar/ }));

    expect(await screen.findByText(VISITA.resumo)).toBeInTheDocument();
    expect(screen.getByText("2026-08-03T15:00")).toBeInTheDocument();
  });

  it("executa a ação confirmada com os args propostos", async () => {
    proporAcoesAction.mockResolvedValue({ ok: true, propostas: [VISITA] });
    executarAcaoAction.mockResolvedValue({ ok: true, message: "Visita agendada." });

    render(<AssistantConsole captacoesUrl="https://captacoes.morabilidade.com" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "agendar visita" } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar/ }));

    fireEvent.click(await screen.findByRole("button", { name: /Confirmar/ }));
    await waitFor(() =>
      expect(executarAcaoAction).toHaveBeenCalledWith("agendar_visita", VISITA.args),
    );
    expect(await screen.findByText(/Visita agendada\./)).toBeInTheDocument();
  });

  it("avisa quando a IA não identifica nenhuma ação", async () => {
    proporAcoesAction.mockResolvedValue({ ok: false, propostas: [], erro: "Nenhuma ação identificada." });

    render(<AssistantConsole captacoesUrl="https://captacoes.morabilidade.com" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "bom dia" } });
    fireEvent.click(screen.getByRole("button", { name: /Analisar/ }));

    expect(await screen.findByText("Nenhuma ação identificada.")).toBeInTheDocument();
  });
});
