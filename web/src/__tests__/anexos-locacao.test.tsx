import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AnexosLocacao } from "@/components/locacoes/anexos-locacao";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
  }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <div role="dialog">
        <button onClick={onConfirm}>Confirmar</button>
      </div>
    ) : null,
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    delete: (...a: unknown[]) => apiDelete(...a),
    patch: vi.fn(),
  },
}));

let currentUserPerfil: "admin" | "corretor" = "admin";
vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (selector: (s: { user: { perfil: string } }) => unknown) =>
    selector({ user: { perfil: currentUserPerfil } }),
}));

beforeEach(async () => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiDelete.mockReset();
  currentUserPerfil = "admin";
  const { toast } = await import("sonner");
  (toast.error as ReturnType<typeof vi.fn>).mockClear();
  (toast.success as ReturnType<typeof vi.fn>).mockClear();
});

const ANEXO = {
  id: "a1",
  contrato_id: "c1",
  tipo: "contrato" as const,
  nome_arquivo: "contrato.pdf",
  firebase_path: "locacoes/c1/abc-contrato.pdf",
  tamanho_bytes: 2048,
  mime_type: "application/pdf",
  uploaded_by: null,
  url: "https://storage.example/contrato.pdf",
  created_at: "2026-05-16T00:00:00+00:00",
};

describe("AnexosLocacao", () => {
  it("lista anexos com link para download", async () => {
    apiGet.mockResolvedValue({ data: [ANEXO] });
    render(<AnexosLocacao contratoId="c1" />);
    await waitFor(() =>
      expect(screen.getByText("contrato.pdf")).toBeInTheDocument()
    );
    const link = screen.getByTitle("Abrir / baixar") as HTMLAnchorElement;
    expect(link.href).toBe("https://storage.example/contrato.pdf");
  });

  it("estado vazio quando não há anexos", async () => {
    apiGet.mockResolvedValue({ data: [] });
    render(<AnexosLocacao contratoId="c1" />);
    await waitFor(() =>
      expect(screen.getByText(/Nenhum anexo enviado/)).toBeInTheDocument()
    );
  });

  it("corretor vê upload e botão de remover (mesmas permissões do admin)", async () => {
    currentUserPerfil = "corretor";
    apiGet.mockResolvedValue({ data: [ANEXO] });
    render(<AnexosLocacao contratoId="c1" />);
    await waitFor(() =>
      expect(screen.getByText("contrato.pdf")).toBeInTheDocument()
    );
    expect(screen.getByText(/Enviar arquivo/)).toBeInTheDocument();
    expect(screen.getByTitle("Remover")).toBeInTheDocument();
  });

  it("faz upload com FormData incluindo o tipo selecionado", async () => {
    apiGet.mockResolvedValueOnce({ data: [] });
    apiPost.mockResolvedValue({});
    apiGet.mockResolvedValueOnce({ data: [ANEXO] });

    const { container } = render(<AnexosLocacao contratoId="c1" />);
    await waitFor(() =>
      expect(screen.getByText(/Nenhum anexo/)).toBeInTheDocument()
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], "x.pdf", {
      type: "application/pdf",
    });
    await userEvent.upload(input, file);

    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    const [url, form, opts] = apiPost.mock.calls[0];
    expect(url).toBe("/locacoes/c1/anexos");
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).get("tipo")).toBe("contrato");
    expect((form as FormData).get("file")).toBeInstanceOf(File);
    expect(opts.headers["Content-Type"]).toBe("multipart/form-data");
  });

  it("confirma e remove anexo", async () => {
    apiGet.mockResolvedValueOnce({ data: [ANEXO] });
    apiDelete.mockResolvedValue({});
    apiGet.mockResolvedValueOnce({ data: [] });

    render(<AnexosLocacao contratoId="c1" />);
    await waitFor(() =>
      expect(screen.getByText("contrato.pdf")).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTitle("Remover"));
    await userEvent.click(screen.getByText("Confirmar"));
    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith("/locacoes/anexos/a1")
    );
  });

  it("exibe mensagem de erro do backend ao falhar upload", async () => {
    apiGet.mockResolvedValueOnce({ data: [] });
    const { toast } = await import("sonner");
    apiPost.mockRejectedValueOnce({
      response: { data: { detail: "Tipo não permitido" } },
    });

    const { container } = render(<AnexosLocacao contratoId="c1" />);
    await waitFor(() =>
      expect(screen.getByText(/Nenhum anexo/)).toBeInTheDocument()
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    // userEvent.upload respeita `accept`; usamos um pdf válido e deixamos o
    // backend (mockado) rejeitar para testar a renderização da mensagem.
    await userEvent.upload(
      input,
      new File([new Uint8Array([1])], "qualquer.pdf", { type: "application/pdf" })
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Tipo não permitido")
    );
  });
});
