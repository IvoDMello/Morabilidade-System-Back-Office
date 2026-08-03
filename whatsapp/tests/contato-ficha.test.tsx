// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ContatoDetalhePage from "@/app/contatos/[id]/page";
import type { Contact } from "@/types/contact";

/** Um contato parado há muito tempo — é o que liga a seção de retomada. */
const PARADO_HA_30_DIAS = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const AGORA = new Date().toISOString();

let atualizadoEm = PARADO_HA_30_DIAS;

function contato(): Contact {
  return {
    id: "contato-1",
    name: "Ana Prado",
    phone: "5521999990000",
    email: null,
    category: "proprietario",
    status: "em_atendimento",
    nextAction: "ligar",
    isFavorite: false,
    isBlocked: false,
    lossReason: null,
    lossReasonNote: null,
    generalNotes: null,
    aiSummary: null,
    aiSummaryGeneratedAt: null,
    clienteId: null,
    clienteCodigo: null,
    corretorId: null,
    createdAt: PARADO_HA_30_DIAS,
    updatedAt: atualizadoEm,
  };
}

vi.mock("@/services/contacts.service", () => ({
  getContactById: async () => contato(),
  ensureClienteVinculo: async (c: Contact) => c,
}));
vi.mock("@/services/notes.service", () => ({ getNotesByContact: async () => [] }));
vi.mock("@/services/reminders.service", () => ({ getRemindersByContact: async () => [] }));
vi.mock("@/services/tags.service", () => ({
  getTags: async () => [],
  getTagsByContact: async () => [],
}));
vi.mock("@/services/events.service", () => ({ getEventsByContact: async () => [] }));
vi.mock("@/services/templates.service", () => ({ getTemplates: async () => [] }));
vi.mock("@/services/properties.service", () => ({
  getProperties: async () => [],
  getPropertiesByContact: async () => [],
}));
vi.mock("@/services/corretores.service", () => ({ getCorretores: async () => [] }));
vi.mock("@/services/whatsapp.service", () => ({ getConversationMessages: async () => [] }));
vi.mock("@/lib/backoffice-api", () => ({ fetchImoveisByCodigos: async () => ({}) }));

// Server actions só precisam existir para os componentes de cliente montarem —
// esta suíte olha a composição da tela, não o que cada ação faz.
vi.mock("@/app/contatos/actions", () => ({
  addNoteAction: vi.fn(),
  addTagToContactAction: vi.fn(),
  assignCorretorAction: vi.fn(),
  cancelReminderAction: vi.fn(),
  completeReminderAction: vi.fn(),
  createReminderAction: vi.fn(),
  createTagAction: vi.fn(),
  deleteContactAction: vi.fn(),
  deleteReminderAction: vi.fn(),
  generateSummaryAction: vi.fn(),
  linkPropertyAction: vi.fn(),
  removeTagFromContactAction: vi.fn(),
  toggleFavoriteAction: vi.fn(),
  unlinkPropertyAction: vi.fn(),
  updateContactStatusAction: vi.fn(),
  updatePropertyRelacaoAction: vi.fn(),
  updatePropertyStageAction: vi.fn(),
  updateReminderAction: vi.fn(),
}));
vi.mock("@/app/conversas/actions", () => ({
  createTemplateAction: vi.fn(),
  deleteTemplateAction: vi.fn(),
  generateFollowUpAction: vi.fn(),
  sendMessageAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/contatos/contato-1",
}));

function renderizar() {
  return ContatoDetalhePage({
    params: Promise.resolve({ id: "contato-1" }),
    searchParams: Promise.resolve({}),
  });
}

/**
 * A ficha tinha dois cartões de IA lado a lado — "Resumo com IA" e "Sugestão de
 * Follow-up" — com o mesmo ícone e a mesma cara, disputando atenção sem que a
 * diferença entre eles aparecesse. São perguntas diferentes e ambas continuam
 * na tela, agora como seções de um cartão só.
 */
describe("Ficha do contato — bloco do assistente", () => {
  afterEach(() => {
    cleanup();
    atualizadoEm = PARADO_HA_30_DIAS;
  });

  it("reúne resumo e retomada num cartão só", async () => {
    render(await renderizar());
    expect(screen.getByText("Assistente")).toBeInTheDocument();
    expect(screen.getByText("Resumo do contato")).toBeInTheDocument();
    expect(screen.getByText("Retomar o contato")).toBeInTheDocument();
    // Os títulos antigos não voltam.
    expect(screen.queryByText("Resumo com IA")).not.toBeInTheDocument();
    expect(screen.queryByText("Sugestão de Follow-up")).not.toBeInTheDocument();
  });

  it("esconde a retomada quando o contato está ativo", async () => {
    atualizadoEm = AGORA;
    render(await renderizar());
    expect(screen.getByText("Resumo do contato")).toBeInTheDocument();
    expect(screen.queryByText("Retomar o contato")).not.toBeInTheDocument();
  });

  it("mantém os blocos de trabalho da coluna de dados", async () => {
    render(await renderizar());
    expect(screen.getByText("Lembretes")).toBeInTheDocument();
    expect(screen.getByText("Imóveis")).toBeInTheDocument();
  });

  it("oferece o alternador de seções para o celular", async () => {
    render(await renderizar());
    expect(screen.getByRole("tab", { name: /Atividade/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Dados do contato/ })).toBeInTheDocument();
  });
});
