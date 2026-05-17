import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PagamentosLocacao } from "@/components/locacoes/pagamentos-locacao";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    title,
  }: { open: boolean; onConfirm: () => void; title: string }) =>
    open ? (
      <div role="dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirmar</button>
      </div>
    ) : null,
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();
const apiDelete = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    patch: (...a: unknown[]) => apiPatch(...a),
    delete: (...a: unknown[]) => apiDelete(...a),
  },
}));

let currentUserPerfil: "admin" | "corretor" = "admin";
vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (selector: (s: { user: { perfil: string } }) => unknown) =>
    selector({ user: { perfil: currentUserPerfil } }),
}));

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiPatch.mockReset();
  apiDelete.mockReset();
  currentUserPerfil = "admin";
});

const PAG_PENDENTE = {
  id: "p1",
  contrato_id: "c1",
  mes_referencia: "2026-05-01",
  valor_devido: "8354.19",
  valor_pago: null,
  data_vencimento: "2026-05-05",
  data_pagamento: null,
  status: "pendente",
  observacoes: null,
  created_at: "2026-05-01T00:00:00+00:00",
  updated_at: "2026-05-01T00:00:00+00:00",
};

describe("PagamentosLocacao", () => {
  it("carrega e renderiza pagamento existente", async () => {
    apiGet.mockResolvedValue({ data: [PAG_PENDENTE] });
    render(
      <PagamentosLocacao contratoId="c1" valorSugerido={8354.19} diaVencimentoPadrao={5} />
    );
    await waitFor(() =>
      expect(screen.getByText(/Maio 2026/)).toBeInTheDocument()
    );
    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });

  it("estado vazio quando não há pagamentos", async () => {
    apiGet.mockResolvedValue({ data: [] });
    render(
      <PagamentosLocacao contratoId="c1" valorSugerido={1000} diaVencimentoPadrao={5} />
    );
    await waitFor(() =>
      expect(screen.getByText(/Nenhum pagamento registrado/)).toBeInTheDocument()
    );
  });

  it("corretor não vê botões de admin", async () => {
    currentUserPerfil = "corretor";
    apiGet.mockResolvedValue({ data: [PAG_PENDENTE] });
    render(
      <PagamentosLocacao contratoId="c1" valorSugerido={1000} diaVencimentoPadrao={5} />
    );
    await waitFor(() => expect(screen.getByText(/Maio 2026/)).toBeInTheDocument());
    expect(screen.queryByText("Gerar próximo mês")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Marcar como pago")).not.toBeInTheDocument();
  });

  it("marca como pago e recarrega", async () => {
    apiGet.mockResolvedValueOnce({ data: [PAG_PENDENTE] });
    apiPatch.mockResolvedValue({});
    apiGet.mockResolvedValueOnce({ data: [{ ...PAG_PENDENTE, status: "pago" }] });

    render(
      <PagamentosLocacao contratoId="c1" valorSugerido={8354.19} diaVencimentoPadrao={5} />
    );
    await waitFor(() => expect(screen.getByText(/Maio 2026/)).toBeInTheDocument());

    await userEvent.click(screen.getByTitle("Marcar como pago"));
    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith("/locacoes/pagamentos/p1", {
        status: "pago",
        valor_pago: "8354.19",
      })
    );
  });

  it("gera próximo mês com dia de vencimento correto", async () => {
    apiGet.mockResolvedValueOnce({ data: [] });
    apiPost.mockResolvedValue({});
    apiGet.mockResolvedValueOnce({ data: [] });

    render(
      <PagamentosLocacao contratoId="c1" valorSugerido={1234.56} diaVencimentoPadrao={5} />
    );
    await waitFor(() =>
      expect(screen.getByText(/Nenhum pagamento registrado/)).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /Gerar próximo mês/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    const [url, payload] = apiPost.mock.calls[0];
    expect(url).toBe("/locacoes/c1/pagamentos");
    expect(payload).toMatchObject({
      valor_devido: 1234.56,
      status: "pendente",
    });
    expect(payload.mes_referencia).toMatch(/^\d{4}-\d{2}-01$/);
    expect(payload.data_vencimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("delete usa dialog de confirmação", async () => {
    apiGet.mockResolvedValueOnce({ data: [PAG_PENDENTE] });
    apiDelete.mockResolvedValue({});
    apiGet.mockResolvedValueOnce({ data: [] });

    render(
      <PagamentosLocacao contratoId="c1" valorSugerido={1000} diaVencimentoPadrao={5} />
    );
    await waitFor(() => expect(screen.getByText(/Maio 2026/)).toBeInTheDocument());

    await userEvent.click(screen.getByTitle("Remover"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Confirmar"));
    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith("/locacoes/pagamentos/p1")
    );
  });
});
