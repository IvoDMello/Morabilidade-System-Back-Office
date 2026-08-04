// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import { MessageComposer } from "@/features/whatsapp/components/message-composer";
import { ReplyProvider } from "@/features/whatsapp/reply-context";
import type { MessageTemplate } from "@/types/template";

expect.extend(toHaveNoViolations);

const sendMessageAction = vi.fn();

vi.mock("@/app/conversas/actions", () => ({
  sendMessageAction: (...a: unknown[]) => sendMessageAction(...a),
  createTemplateAction: vi.fn(),
  deleteTemplateAction: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TEMPLATES: MessageTemplate[] = [
  {
    id: "tpl-1",
    title: "Boas-vindas",
    body: "Olá! Aqui é da Morabilidade.",
    createdAt: "2026-08-01T12:00:00Z",
  },
];

/** Ponteiro grosso = celular/tablet; ponteiro fino = mouse com teclado físico. */
function simularPonteiro(tipo: "coarse" | "fine") {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("coarse") ? tipo === "coarse" : tipo === "fine",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function montar() {
  return render(
    <ReplyProvider>
      <MessageComposer contactId="contato-1" contactName="Ana Prado" templates={TEMPLATES} />
    </ReplyProvider>,
  );
}

function campo(): HTMLTextAreaElement {
  return screen.getByLabelText("Mensagem para Ana Prado") as HTMLTextAreaElement;
}

/**
 * O composer é onde a mensagem sai para um cliente de verdade — errar aqui
 * custa caro e é público. O caso que mais dói é o Enter no celular: o teclado
 * virtual usa essa tecla para quebrar linha, então tratá-la como envio
 * impedia escrever mais de um parágrafo e mandava texto pela metade.
 */
describe("Composer da conversa", () => {
  beforeEach(() => sendMessageAction.mockReset());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("não tem violações de acessibilidade (jest-axe)", async () => {
    simularPonteiro("fine");
    const { container } = montar();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("no celular, Enter não envia — quebra linha", async () => {
    simularPonteiro("coarse");
    montar();

    fireEvent.change(campo(), { target: { value: "Bom dia, Ana" } });
    await waitFor(() => expect(campo()).toHaveAttribute("enterkeyhint", "enter"));
    fireEvent.keyDown(campo(), { key: "Enter", shiftKey: false });

    expect(sendMessageAction).not.toHaveBeenCalled();
  });

  it("com teclado físico, Enter envia", async () => {
    simularPonteiro("fine");
    sendMessageAction.mockResolvedValue(undefined);
    montar();

    fireEvent.change(campo(), { target: { value: "Bom dia, Ana" } });
    fireEvent.keyDown(campo(), { key: "Enter", shiftKey: false });

    await waitFor(() => expect(sendMessageAction).toHaveBeenCalledTimes(1));
    expect(sendMessageAction.mock.calls[0][0]).toBe("contato-1");
    expect(sendMessageAction.mock.calls[0][1]).toEqual({ body: "Bom dia, Ana" });
  });

  it("Shift+Enter nunca envia, em nenhum dispositivo", async () => {
    simularPonteiro("fine");
    montar();

    fireEvent.change(campo(), { target: { value: "Primeira linha" } });
    fireEvent.keyDown(campo(), { key: "Enter", shiftKey: true });

    expect(sendMessageAction).not.toHaveBeenCalled();
  });

  it("o botão de enviar fica inativo sem texto", async () => {
    simularPonteiro("fine");
    montar();

    const enviar = screen.getByRole("button", { name: "Enviar mensagem" });
    expect(enviar).toBeDisabled();

    fireEvent.change(campo(), { target: { value: "  " } });
    await waitFor(() => expect(enviar).toBeDisabled());

    fireEvent.change(campo(), { target: { value: "Oi" } });
    await waitFor(() => expect(enviar).toBeEnabled());
  });

  it("no desktop, digitar / abre as respostas rápidas e Enter escolhe", async () => {
    simularPonteiro("fine");
    montar();

    fireEvent.change(campo(), { target: { value: "/boas" } });
    expect(await screen.findByText("Boas-vindas")).toBeInTheDocument();

    fireEvent.keyDown(campo(), { key: "Enter", shiftKey: false });
    // Enter escolheu o template em vez de enviar.
    await waitFor(() => expect(campo()).toHaveValue("Olá! Aqui é da Morabilidade."));
    expect(sendMessageAction).not.toHaveBeenCalled();
  });

  it("no celular a lista de respostas rápidas aparece, mas Enter não a sequestra", async () => {
    simularPonteiro("coarse");
    montar();

    fireEvent.change(campo(), { target: { value: "/boas" } });
    expect(await screen.findByText("Boas-vindas")).toBeInTheDocument();

    fireEvent.keyDown(campo(), { key: "Enter", shiftKey: false });
    // O texto continua sendo do usuário: a escolha ali é tocando no item.
    expect(campo()).toHaveValue("/boas");
    expect(sendMessageAction).not.toHaveBeenCalled();
  });
});
