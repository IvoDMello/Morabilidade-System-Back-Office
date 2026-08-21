// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import { OportunidadesView } from "@/features/oportunidades/components/oportunidades-view";
import type {
  ImovelCompativel,
  OportunidadeDoContato,
  PainelOportunidades,
} from "@/types/oportunidade";

expect.extend(toHaveNoViolations);

const enviarImoveisAction = vi.fn();
const salvarPreferenciaAction = vi.fn();

vi.mock("@/app/oportunidades/actions", () => ({
  enviarImoveisAction: (...args: unknown[]) => enviarImoveisAction(...args),
  salvarPreferenciaAction: (...args: unknown[]) => salvarPreferenciaAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function imovel(over: Partial<ImovelCompativel> = {}): ImovelCompativel {
  return {
    id: "im1",
    codigo: "MB-00033",
    titulo: "Cobertura em Ipanema",
    cidade: "Rio de Janeiro",
    bairro: "Ipanema",
    tipoImovel: "cobertura",
    tipoNegocio: "venda",
    andar: 8,
    valorVenda: 4_200_000,
    valorLocacao: null,
    dormitorios: 3,
    vagasGaragem: 2,
    fotoCapa: null,
    criterios: [],
    definidos: 2,
    atendidos: 2,
    compativel: true,
    quase: false,
    valor: 4_200_000,
    jaEnviado: false,
    ...over,
  };
}

function item(over: Partial<OportunidadeDoContato> = {}): OportunidadeDoContato {
  return {
    contactId: "c1",
    nome: "Fernanda Lima",
    telefone: "5521999990000",
    categoria: "comprador",
    status: "visita_marcada",
    clienteId: "cli-1",
    clienteCodigo: "CL-1",
    preferencia: {
      clienteId: "cli-1",
      tipoNegocio: "venda",
      tipoImovel: "cobertura",
      cidade: "Rio de Janeiro",
      bairros: ["Ipanema"],
      valorMin: null,
      valorMax: 5_000_000,
      dormitoriosMin: 3,
      vagasGaragemMin: null,
      observacoes: null,
      origem: "manual",
      atualizadaEm: null,
    },
    imoveis: [imovel()],
    compativeis: 1,
    janela: { aberta: true, fechaEm: "2026-08-22T12:00:00Z" },
    codigosDeInteresse: [],
    ...over,
  };
}

function painel(over: Partial<PainelOportunidades> = {}): PainelOportunidades {
  return {
    itens: [item()],
    totalImoveis: 12,
    semPerfil: 0,
    catalogoDisponivel: true,
    ...over,
  };
}

function renderizar(p: PainelOportunidades = painel()) {
  return render(
    <OportunidadesView painel={p} siteUrl="https://morabilidade.com" />,
  );
}

beforeEach(() => {
  enviarImoveisAction.mockReset();
  enviarImoveisAction.mockResolvedValue({ ok: true });
  salvarPreferenciaAction.mockReset();
});

afterEach(cleanup);

/**
 * O que a aba promete: dizer quais imóveis combinam com cada contato e tornar
 * o envio fácil. Estes testes travam as duas pontas — o caminho do clique até
 * a mensagem pronta, e os avisos que impedem um envio que iria falhar.
 */
describe("aba de Oportunidades", () => {
  it("abre em 'Prontos para enviar' — a visão em que existe ação a tomar", () => {
    renderizar();
    expect(screen.getByRole("button", { name: /Prontos para enviar/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Fernanda Lima")).toBeInTheDocument();
  });

  it("escolher um imóvel já monta a mensagem com código, valor e link", async () => {
    renderizar();
    fireEvent.click(screen.getByText("Fernanda Lima"));
    fireEvent.click(screen.getByRole("checkbox", { name: /Incluir MB-00033/ }));

    const caixa = (await screen.findByRole("textbox", {
      name: /Mensagem para Fernanda Lima/,
    })) as HTMLTextAreaElement;
    expect(caixa.value).toContain("Oi, Fernanda!");
    expect(caixa.value).toContain("MB-00033");
    expect(caixa.value).toContain("R$ 4.200.000");
    expect(caixa.value).toContain("https://morabilidade.com/imoveis/MB-00033");
  });

  it("envia o texto revisado e os imóveis escolhidos", async () => {
    renderizar();
    fireEvent.click(screen.getByText("Fernanda Lima"));
    fireEvent.click(screen.getByRole("checkbox", { name: /Incluir MB-00033/ }));
    await screen.findByRole("textbox", { name: /Mensagem para Fernanda Lima/ });

    fireEvent.click(screen.getByRole("button", { name: /Enviar no WhatsApp/ }));

    await waitFor(() => expect(enviarImoveisAction).toHaveBeenCalledTimes(1));
    const [contactId, texto, imoveis] = enviarImoveisAction.mock.calls[0];
    expect(contactId).toBe("c1");
    expect(texto).toContain("MB-00033");
    expect(imoveis).toEqual([{ codigo: "MB-00033", titulo: "Cobertura em Ipanema" }]);
  });

  it("avisa antes de tentar enviar com a janela de 24h fechada", async () => {
    renderizar(painel({ itens: [item({ janela: { aberta: false, fechaEm: null } })] }));
    fireEvent.click(screen.getByText("Fernanda Lima"));
    fireEvent.click(screen.getByRole("checkbox", { name: /Incluir MB-00033/ }));

    expect(await screen.findByText(/janela de 24h está fechada/)).toBeInTheDocument();
  });

  it("no 'quase', diz o que falta em vez de esconder o imóvel", () => {
    renderizar(
      painel({
        itens: [
          item({
            compativeis: 0,
            imoveis: [
              imovel({
                compativel: false,
                quase: true,
                atendidos: 2,
                definidos: 3,
                criterios: [
                  { chave: "vagas", rotulo: "Vagas", pedido: "2+", status: "fora" },
                ],
              }),
            ],
          }),
        ],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Quase lá/ }));
    fireEvent.click(screen.getByText("Fernanda Lima"));
    expect(screen.getByText(/falta Vagas 2\+/)).toBeInTheDocument();
  });

  it("contato sem perfil de busca é convidado a preencher, não escondido", () => {
    renderizar(
      painel({
        semPerfil: 1,
        itens: [item({ preferencia: null, imoveis: [], compativeis: 0 })],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Sem perfil/ }));
    fireEvent.click(screen.getByText("Fernanda Lima"));
    expect(screen.getByRole("button", { name: /Preencher perfil/ })).toBeInTheDocument();
  });

  it("quando o catálogo não responde, diz isso em vez de exibir zero", () => {
    renderizar(painel({ catalogoDisponivel: false, totalImoveis: 0 }));
    expect(screen.getByText(/catálogo de imóveis não respondeu/)).toBeInTheDocument();
  });

  it("não tem violações de acessibilidade", async () => {
    const { container } = renderizar();
    expect(await axe(container)).toHaveNoViolations();
  });
});
