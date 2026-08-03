// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import DashboardPage from "@/app/dashboard/page";
import type { DashboardStats } from "@/types/dashboard";
import type { ReminderWithContact } from "@/types/reminder";
import type { Contact } from "@/types/contact";

expect.extend(toHaveNoViolations);

const LEMBRETE: ReminderWithContact = {
  id: "lem-1",
  contactId: "contato-1",
  title: "Ligar para o proprietário",
  description: null,
  reminderAt: "2026-08-02T18:00:00Z",
  status: "pendente",
  createdBy: "Rodrigo",
  corretorId: null,
  imovelCodigo: null,
  fichaVisitaId: null,
  fichaNotificadaEm: null,
  googleCalendarEventId: null,
  createdAt: "2026-08-01T12:00:00Z",
  updatedAt: "2026-08-01T12:00:00Z",
  contactName: "Ana Prado",
  contactPhone: "5521999990000",
};

const CONTATO: Contact = {
  id: "contato-1",
  name: "Ana Prado",
  phone: "5521999990000",
  email: null,
  category: "proprietario",
  status: "novo",
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
  createdAt: "2026-08-01T12:00:00Z",
  updatedAt: "2026-08-02T12:00:00Z",
};

const STATS: DashboardStats = {
  totalContacts: 42,
  totalContactsDelta: 5,
  contactsByCategory: {} as DashboardStats["contactsByCategory"],
  contactsByStatus: {} as DashboardStats["contactsByStatus"],
  pendingReminders: 9,
  pendingRemindersDelta: 0,
  overdueReminders: 3,
  overdueRemindersDelta: 0,
  todayReminders: [LEMBRETE],
  todayRemindersDelta: 0,
  recentContacts: [CONTATO],
};

vi.mock("@/services/dashboard.service", () => ({
  getDashboardStats: async () => STATS,
}));

vi.mock("@/services/whatsapp.service", () => ({
  getPendingConversationsCount: async () => 7,
}));

function linkDe(nome: RegExp | string): string | null {
  return screen.getByRole("link", { name: nome }).getAttribute("href");
}

/**
 * A visão geral avisava "3 lembretes vencidos" e parava por aí — o número não
 * levava a lugar nenhum, e quem via precisava caçar a tela certa no menu.
 * Estes testes fixam que cada indicador tem para onde ir, e que o painel mede
 * o atendimento (conversas aguardando) e não uma contagem de lembretes que
 * incluía o que vence daqui a três semanas.
 */
describe("Visão geral — indicadores levam a algum lugar", () => {
  afterEach(cleanup);

  it("não tem violações de acessibilidade (jest-axe)", async () => {
    const { container } = render(await DashboardPage());
    expect(await axe(container)).toHaveNoViolations();
  });

  it("mede conversas aguardando, não lembretes pendentes", async () => {
    render(await DashboardPage());
    expect(screen.getByText("Conversas aguardando")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByText("Lembretes pendentes")).not.toBeInTheDocument();
  });

  it("cada indicador acionável aponta para a tela que resolve", async () => {
    render(await DashboardPage());
    expect(linkDe("Conversas aguardando: 7")).toBe("/pendencias?tab=aguardando");
    expect(linkDe("Lembretes vencidos: 3")).toBe("/pendencias?tab=lembretes");
    expect(linkDe("Lembretes de hoje: 1")).toBe("/pendencias?tab=lembretes");
    expect(linkDe("Total de contatos: 42")).toBe("/contatos");
  });

  it("as listas de relance também apontam para onde se age", async () => {
    render(await DashboardPage());
    expect(linkDe("Ver em Pendências")).toBe("/pendencias?tab=lembretes");
    expect(linkDe("Ver todos")).toBe("/contatos");
  });
});
