// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import { PendenciasView } from "@/features/pendencias/components/pendencias-view";
import type { PendingConversationItem, PendingQueue } from "@/services/whatsapp.service";
import type { ReminderWithContact } from "@/types/reminder";
import type { Contact } from "@/types/contact";
import type { FailedOutboundMessage } from "@/types/whatsapp";

expect.extend(toHaveNoViolations);

const analisarComIaAction = vi.fn();

vi.mock("@/app/pendencias/actions", () => ({
  analisarComIaAction: (...args: unknown[]) => analisarComIaAction(...args),
  closeConversationAction: vi.fn(),
  snoozeFollowUpAction: vi.fn(),
}));

vi.mock("@/app/contatos/actions", () => ({
  completeReminderAction: vi.fn(),
  cancelReminderAction: vi.fn(),
  deleteReminderAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function conversa(over: Partial<PendingConversationItem> = {}): PendingConversationItem {
  return {
    id: "conv-1",
    contactId: "contato-1",
    waPhoneNumber: "5521999990000",
    lastMessageAt: "2026-08-02T12:00:00Z",
    lastMessagePreview: "Bom dia, pode me passar o valor?",
    lastMessageDirection: "inbound",
    unreadCount: 1,
    status: "aguardando_resposta",
    lastInboundAt: "2026-08-02T12:00:00Z",
    lastOutboundAt: null,
    statusChangedAt: "2026-08-02T12:00:00Z",
    followUpSnoozedUntil: null,
    lastAlertAt: null,
    pinnedAt: null,
    createdAt: "2026-08-01T12:00:00Z",
    updatedAt: "2026-08-02T12:00:00Z",
    contactName: "Ana Prado",
    contactPhone: "5521999990000",
    contactIsFavorite: false,
    contactIsBlocked: false,
    contactTagIds: [],
    contactCorretorId: null,
    property: null,
    ...over,
  };
}

function lembrete(over: Partial<ReminderWithContact> = {}): ReminderWithContact {
  return {
    id: "lem-1",
    contactId: "contato-2",
    title: "Visita MB-00033",
    description: null,
    reminderAt: "2026-08-02T18:00:00Z",
    status: "pendente",
    createdBy: "Rodrigo",
    corretorId: null,
    imovelCodigo: "MB-00033",
    fichaVisitaId: null,
    fichaNotificadaEm: null,
    googleCalendarEventId: null,
    createdAt: "2026-08-01T12:00:00Z",
    updatedAt: "2026-08-01T12:00:00Z",
    contactName: "Bruno Salles",
    contactPhone: "5521988887777",
    ...over,
  };
}

const CONTATOS: Contact[] = [];

const QUEUE: PendingQueue = {
  aguardandoResposta: [conversa()],
  followUpSugerido: [conversa({ id: "conv-2", contactId: "c2", contactName: "Carla Dias" })],
  todasAtivas: [conversa()],
};

const GRUPOS = { overdue: [lembrete()], today: [], upcoming: [] };

function montar() {
  return render(
    <PendenciasView
      queue={QUEUE}
      reminders={GRUPOS}
      contacts={CONTATOS}
      falhas={[]}
      defaultTab="aguardando"
    />,
  );
}

/**
 * Pendências e Lembretes viraram uma tela só. Estes testes cobrem o que a
 * análise estática não vê: que as duas filas continuam alcançáveis na mesma
 * barra de abas e que a revisão de IA — antes dois botões separados — entrega
 * as duas leituras num clique só.
 */
describe("Central de pendências unificada", () => {
  beforeEach(() => analisarComIaAction.mockReset());
  afterEach(cleanup);

  it("não tem violações de acessibilidade (jest-axe)", async () => {
    const { container } = montar();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("expõe conversas e lembretes na mesma barra de abas", async () => {
    montar();
    // Aba inicial: a fila de conversas aguardando resposta.
    expect(screen.getByRole("tab", { name: /Aguardando \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText("Ana Prado")).toBeInTheDocument();

    // Os lembretes deixaram de ser outra página — são a aba ao lado.
    fireEvent.click(screen.getByRole("tab", { name: /Lembretes \(1\)/ }));
    expect(await screen.findByText("Visita MB-00033")).toBeInTheDocument();
    expect(screen.getByText("Vencidos")).toBeInTheDocument();
  });

  it("abre direto na aba pedida pela URL (link antigo de /lembretes)", async () => {
    render(
      <PendenciasView
        queue={QUEUE}
        reminders={GRUPOS}
        contacts={CONTATOS}
        falhas={[]}
        defaultTab="lembretes"
      />,
    );
    expect(await screen.findByText("Visita MB-00033")).toBeInTheDocument();
  });

  it("um único botão de IA traz a análise do dia e marca as já resolvidas", async () => {
    analisarComIaAction.mockResolvedValue({
      ok: true,
      pendencias: [{ contato: "Ana Prado", motivo: "prometeu enviar fotos", urgencia: "alta" }],
      encerramentos: { "conv-1": "cliente só agradeceu" },
    });

    montar();
    fireEvent.click(screen.getByRole("button", { name: "Revisar agora" }));

    await waitFor(() => expect(analisarComIaAction).toHaveBeenCalledTimes(1));
    // Uma chamada, as duas leituras: a lista do dia...
    expect(await screen.findByText(/prometeu enviar fotos/)).toBeInTheDocument();
    // ...e a marca de "não precisa de resposta" no cartão da conversa.
    expect(screen.getByText(/cliente só agradeceu/)).toBeInTheDocument();
  });

  it("mostra a análise que veio quando só uma das leituras falha", async () => {
    analisarComIaAction.mockResolvedValue({
      ok: true,
      pendencias: [{ contato: "Ana Prado", motivo: "sem resposta há 2 dias", urgencia: "media" }],
      encerramentos: {},
      erro: "Não foi possível revisar agora. Tente novamente.",
    });

    montar();
    fireEvent.click(screen.getByRole("button", { name: "Revisar agora" }));

    expect(await screen.findByText(/sem resposta há 2 dias/)).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível revisar agora/)).toBeInTheDocument();
  });
});

describe("aba de envios não entregues", () => {
  afterEach(cleanup);

  const FALHA: FailedOutboundMessage = {
    id: "msg-falha",
    conversationId: "conv-1",
    contactId: "c1",
    contactName: "Marina Alves",
    contactPhone: "5521970005555",
    body: "Segue o link da ficha",
    errorMessage: "Message failed to send because more than 24 hours have passed",
    createdBy: "Leandro",
    waTimestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  };

  function montarComFalha(falhas: FailedOutboundMessage[]) {
    return render(
      <PendenciasView
        queue={QUEUE}
        reminders={GRUPOS}
        contacts={CONTATOS}
        falhas={falhas}
        defaultTab="aguardando"
      />,
    );
  }

  it("a aba só existe quando há falha", () => {
    montarComFalha([]);
    // Uma aba permanentemente zerada ensina a ignorá-la.
    expect(screen.queryByRole("tab", { name: /Não entregues/ })).not.toBeInTheDocument();
  });

  it("mostra o motivo da recusa, que antes não aparecia em lugar nenhum", async () => {
    montarComFalha([FALHA]);

    fireEvent.click(screen.getByRole("tab", { name: /Não entregues \(1\)/ }));

    expect(await screen.findByText("Marina Alves")).toBeInTheDocument();
    // O texto que falhou: é o que a pessoa precisa para reenviar.
    expect(screen.getByText("Segue o link da ficha")).toBeInTheDocument();
    expect(screen.getByText(/more than 24 hours have passed/)).toBeInTheDocument();
  });

  it("sem motivo da Meta, diz isso em vez de deixar em branco", async () => {
    montarComFalha([{ ...FALHA, errorMessage: null }]);

    fireEvent.click(screen.getByRole("tab", { name: /Não entregues/ }));

    expect(await screen.findByText(/a Meta não informou o motivo/)).toBeInTheDocument();
  });

  it("deep-link para a aba sem falhas cai na fila principal", async () => {
    render(
      <PendenciasView
        queue={QUEUE}
        reminders={GRUPOS}
        contacts={CONTATOS}
        falhas={[]}
        defaultTab="falhas"
      />,
    );
    // Cairia numa tela vazia sem nenhuma aba marcada.
    expect(await screen.findByText("Ana Prado")).toBeInTheDocument();
  });
});
