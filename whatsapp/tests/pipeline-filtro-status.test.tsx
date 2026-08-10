// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ContactPipelineBoard } from "@/features/contacts/pipeline/components/contact-pipeline-board";
import type { Contact } from "@/types/contact";
import type { ContactStatus } from "@/constants/contact-status";

vi.mock("@/app/contatos/actions", () => ({ updateContactStatusAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function contato(nome: string, status: ContactStatus): Contact {
  return {
    id: `c-${nome}`,
    name: nome,
    phone: "5511911112222",
    email: null,
    category: "comprador",
    status,
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
    updatedAt: "2026-08-01T12:00:00Z",
  };
}

const CONTATOS = [
  contato("Camila Rodrigues", "documentacao"),
  contato("Juliana Torres", "novo"),
];

/**
 * Filtrar por "Documentação" e continuar vendo sete colunas — seis delas
 * vazias — não é filtrar, é pintar de cinza: a etapa escolhida some no meio
 * das outras e ainda é preciso rolar o board para achá-la.
 */
describe("Pipeline com filtro de status", () => {
  afterEach(cleanup);

  it("sem filtro, mostra o funil inteiro", () => {
    render(<ContactPipelineBoard contacts={CONTATOS} />);
    expect(screen.getByText("Documentação")).toBeInTheDocument();
    expect(screen.getByText("Novo")).toBeInTheDocument();
    expect(screen.getByText("Finalizado")).toBeInTheDocument();
  });

  it("com filtro, mostra só a etapa escolhida", () => {
    render(<ContactPipelineBoard contacts={CONTATOS} statusFiltro="documentacao" />);
    expect(screen.getByText("Documentação")).toBeInTheDocument();
    expect(screen.queryByText("Novo")).not.toBeInTheDocument();
    expect(screen.queryByText("Finalizado")).not.toBeInTheDocument();
  });

  it("os contatos daquela etapa continuam lá", () => {
    render(<ContactPipelineBoard contacts={CONTATOS} statusFiltro="documentacao" />);
    expect(screen.getByText("Camila Rodrigues")).toBeInTheDocument();
    expect(screen.queryByText("Juliana Torres")).not.toBeInTheDocument();
  });

  it("avisa que não dá para mover com uma etapa só na tela", () => {
    render(<ContactPipelineBoard contacts={CONTATOS} statusFiltro="documentacao" />);
    expect(screen.getByText(/limpe o filtro de status/)).toBeInTheDocument();
    // E a dica de arrastar, que seria uma instrução impossível, sai.
    expect(screen.queryByText(/Segure um cartão/)).not.toBeInTheDocument();
  });
});
