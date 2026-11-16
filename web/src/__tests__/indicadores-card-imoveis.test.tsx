import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ImoveisPage from "@/app/(dashboard)/imoveis/page";

/**
 * Indicadores no topo do card da listagem de Imóveis: Instagram, YouTube e
 * documentos anexados (clipe + quantidade). Cada um só aparece quando existe,
 * e o clipe leva direto para a aba de documentos do imóvel.
 */

const apiGetMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGetMock(...args) },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (seletor: (s: unknown) => unknown) => seletor({ user: { perfil: "admin" } }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function imovel(overrides = {}) {
  return {
    id: "imovel-1",
    codigo: "MB-00065",
    tipo_negocio: "venda",
    disponibilidade: "disponivel",
    cidade: "Rio de Janeiro",
    bairro: "Humaitá",
    logradouro: "Rua Mário Pederneiras",
    numero: "10",
    tipo_imovel: "cobertura",
    tags: [],
    instagram_url: null,
    youtube_url: null,
    total_documentos: 0,
    tipos_documentos: [] as string[],
    created_at: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

function listarCom(item: ReturnType<typeof imovel>) {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/imoveis/localidades") {
      return Promise.resolve({ data: { cidades: [], bairros: [], bairros_por_cidade: {} } });
    }
    return Promise.resolve({ data: [item], headers: { "x-total-count": "1" } });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Card de imóvel, indicadores", () => {
  it("mostra o YouTube quando tem vídeo, com link para o vídeo", async () => {
    listarCom(imovel({ youtube_url: "https://www.youtube.com/watch?v=abc123" }));
    render(<ImoveisPage />);
    const link = await screen.findByTitle("Vídeo no YouTube, abrir vídeo");
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=abc123");
  });

  it("aceita youtu.be e shorts como vídeo válido", async () => {
    listarCom(imovel({ youtube_url: "https://youtu.be/abc123" }));
    const { unmount } = render(<ImoveisPage />);
    expect(await screen.findByTitle("Vídeo no YouTube, abrir vídeo")).toBeInTheDocument();
    unmount();

    listarCom(imovel({ youtube_url: "https://www.youtube.com/shorts/abc123" }));
    render(<ImoveisPage />);
    expect(await screen.findByTitle("Vídeo no YouTube, abrir vídeo")).toBeInTheDocument();
  });

  it("avisa quando o link do YouTube não é de um vídeo", async () => {
    listarCom(imovel({ youtube_url: "https://www.youtube.com/@morabilidade" }));
    render(<ImoveisPage />);
    expect(
      await screen.findByTitle("Link do YouTube preenchido, mas não parece um vídeo válido, verifique"),
    ).toBeInTheDocument();
  });

  it("mostra o clipe com a quantidade de documentos e abre a aba de documentos", async () => {
    listarCom(imovel({ total_documentos: 3 }));
    render(<ImoveisPage />);
    const clipe = await screen.findByTitle("3 documentos anexados, abrir documentos");
    expect(clipe).toHaveTextContent("3");
    fireEvent.click(clipe);
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/imoveis/imovel-1?aba=documentos");
  });

  it("um documento só, no singular", async () => {
    listarCom(imovel({ total_documentos: 1 }));
    render(<ImoveisPage />);
    expect(await screen.findByTitle("1 documento anexado, abrir documentos")).toBeInTheDocument();
  });

  it("mostra só as flags que têm documento, na ordem IPTU, RGI, Condomínio, Planta, Escritura", async () => {
    listarCom(
      imovel({ total_documentos: 4, tipos_documentos: ["escritura", "iptu", "contrato", "matricula"] }),
    );
    render(<ImoveisPage />);
    await screen.findByTitle("4 documentos anexados, abrir documentos");

    const flags = screen.getAllByTitle(/ anexado$/).map((el) => el.getAttribute("title"));
    // Contrato não é flag, e Condomínio/Planta não têm documento.
    expect(flags).toEqual(["IPTU anexado", "RGI anexado", "Escritura anexado"]);
  });

  it("clicar numa flag abre a aba de documentos", async () => {
    listarCom(imovel({ total_documentos: 1, tipos_documentos: ["planta"] }));
    render(<ImoveisPage />);
    fireEvent.click(await screen.findByTitle("Planta anexado"));
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/imoveis/imovel-1?aba=documentos");
  });

  it("sem vídeo e sem documentos, nenhum dos dois aparece", async () => {
    listarCom(imovel());
    render(<ImoveisPage />);
    await screen.findByTitle("Editar");
    expect(screen.queryByTitle(/YouTube/)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/documento/)).not.toBeInTheDocument();
  });
});
