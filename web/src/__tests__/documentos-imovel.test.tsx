import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { DocumentosImovel } from "@/components/imoveis/documentos-imovel";
import { tipoPeloNomeDoArquivo } from "@/lib/documentos-imovel";

/**
 * Aba Documentos do imóvel: as 5 flags (IPTU, RGI, Condomínio, Planta,
 * Escritura), a troca de flag de um documento já enviado e a flag sugerida
 * pelo nome do arquivo no envio.
 */

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiPatchMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    post: (...a: unknown[]) => apiPostMock(...a),
    patch: (...a: unknown[]) => apiPatchMock(...a),
    delete: vi.fn(),
  },
}));

let perfil = "corretor";
vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (seletor: (s: unknown) => unknown) => seletor({ user: { perfil } }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

vi.mock("@/components/ConfirmDialog", () => ({ ConfirmDialog: () => null }));

function doc(id: string, tipo: string, nome: string) {
  return {
    id,
    imovel_id: "im-1",
    tipo,
    nome_arquivo: nome,
    firebase_path: `p/${nome}`,
    mime_type: "application/pdf",
    tamanho_bytes: 1000,
    created_at: "2026-11-16T12:00:00+00:00",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  perfil = "corretor";
});

describe("tipoPeloNomeDoArquivo", () => {
  it("reconhece os nomes como o corretor costuma salvar", () => {
    expect(tipoPeloNomeDoArquivo("ESCRITURA SAMBAÍBA.pdf")).toBe("escritura");
    expect(tipoPeloNomeDoArquivo("IPTU SAMBAÍBA.jpeg")).toBe("iptu");
    expect(tipoPeloNomeDoArquivo("CONDOMÍNIO SAMBAIBA.jpeg")).toBe("condominio");
    expect(tipoPeloNomeDoArquivo("planta_baixa.png")).toBe("planta");
    expect(tipoPeloNomeDoArquivo("IPTU2024.pdf")).toBe("iptu");
  });

  it("RGI, matrícula e ônus reais são todos o RGI", () => {
    expect(tipoPeloNomeDoArquivo("RGI Leblon.pdf")).toBe("matricula");
    expect(tipoPeloNomeDoArquivo("Matrícula 12345.pdf")).toBe("matricula");
    expect(tipoPeloNomeDoArquivo("certidao-de-onus-reais.pdf")).toBe("matricula");
  });

  it("não chuta quando o nome não diz", () => {
    expect(tipoPeloNomeDoArquivo("foto 1.jpg")).toBeNull();
    // Palavra inteira: "plantao" não é planta.
    expect(tipoPeloNomeDoArquivo("escala plantao.pdf")).toBeNull();
  });
});

describe("DocumentosImovel, flags", () => {
  it("acende as flags que têm documento e deixa apagadas as que faltam", async () => {
    apiGetMock.mockResolvedValue({
      data: [doc("d1", "iptu", "a.pdf"), doc("d2", "iptu", "b.pdf"), doc("d3", "matricula", "c.pdf")],
    });
    render(<DocumentosImovel imovelId="im-1" />);

    expect(await screen.findByTitle("IPTU: 2 documentos anexados")).toBeInTheDocument();
    expect(screen.getByTitle("RGI: 1 documento anexado")).toBeInTheDocument();
    expect(screen.getByTitle("Condomínio: nenhum documento anexado")).toBeInTheDocument();
    expect(screen.getByTitle("Planta: nenhum documento anexado")).toBeInTheDocument();
    expect(screen.getByTitle("Escritura: nenhum documento anexado")).toBeInTheDocument();
  });

  it("troca a flag de um documento já enviado", async () => {
    apiGetMock.mockResolvedValue({ data: [doc("d1", "contrato", "IPTU SAMBAÍBA.jpeg")] });
    apiPatchMock.mockResolvedValue({ data: {} });
    render(<DocumentosImovel imovelId="im-1" />);

    const seletor = await screen.findByLabelText("Flag de IPTU SAMBAÍBA.jpeg");
    expect(screen.getByTitle("IPTU: nenhum documento anexado")).toBeInTheDocument();

    fireEvent.change(seletor, { target: { value: "iptu" } });

    expect(apiPatchMock).toHaveBeenCalledWith("/imoveis/im-1/documentos/d1", { tipo: "iptu" });
    expect(screen.getByTitle("IPTU: 1 documento anexado")).toBeInTheDocument();
  });

  it("se a API recusar, a flag volta e avisa", async () => {
    apiGetMock.mockResolvedValue({ data: [doc("d1", "contrato", "x.pdf")] });
    apiPatchMock.mockRejectedValue(new Error("falhou"));
    render(<DocumentosImovel imovelId="im-1" />);

    const seletor = (await screen.findByLabelText("Flag de x.pdf")) as HTMLSelectElement;
    fireEvent.change(seletor, { target: { value: "escritura" } });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(seletor.value).toBe("contrato");
    expect(screen.getByTitle("Escritura: nenhum documento anexado")).toBeInTheDocument();
  });

  it("sem permissão de escrita mostra a flag, sem seletor", async () => {
    perfil = "visualizador";
    apiGetMock.mockResolvedValue({ data: [doc("d1", "matricula", "x.pdf")] });
    render(<DocumentosImovel imovelId="im-1" />);

    const linha = await screen.findByRole("listitem");
    expect(within(linha).getByText("RGI")).toBeInTheDocument();
    expect(screen.queryByLabelText("Flag de x.pdf")).not.toBeInTheDocument();
  });
});

describe("DocumentosImovel, envio", () => {
  async function enviar(...nomes: string[]) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const arquivos = nomes.map((n) => new File(["x"], n, { type: "application/pdf" }));
    fireEvent.change(input, { target: { files: arquivos } });
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(nomes.length));
    return apiPostMock.mock.calls.map((c) => (c[1] as FormData).get("tipo"));
  }

  it("por padrão cada arquivo pega a flag pelo nome, e o resto vira Outro", async () => {
    apiGetMock.mockResolvedValue({ data: [] });
    apiPostMock.mockResolvedValue({ data: {} });
    render(<DocumentosImovel imovelId="im-1" />);
    await screen.findByText("Nenhum documento enviado.");

    const tipos = await enviar("ESCRITURA SAMBAÍBA.pdf", "IPTU SAMBAÍBA.pdf", "foto.pdf");
    expect(tipos).toEqual(["escritura", "iptu", "outro"]);
  });

  it("flag escolhida no seletor vale para todos os arquivos do envio", async () => {
    apiGetMock.mockResolvedValue({ data: [] });
    apiPostMock.mockResolvedValue({ data: {} });
    render(<DocumentosImovel imovelId="im-1" />);
    await screen.findByText("Nenhum documento enviado.");

    fireEvent.change(screen.getByLabelText("Flag dos arquivos enviados"), {
      target: { value: "planta" },
    });
    const tipos = await enviar("IPTU.pdf", "qualquer.pdf");
    expect(tipos).toEqual(["planta", "planta"]);
  });
});
