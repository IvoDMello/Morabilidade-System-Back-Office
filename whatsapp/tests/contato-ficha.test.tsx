// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ContatoDetalhePage from "@/app/contatos/[id]/page";
import type { Contact } from "@/types/contact";
import type { DossieCliente } from "@/lib/backoffice-api";

/** Um contato parado há muito tempo — é o que liga a seção de retomada. */
const PARADO_HA_30_DIAS = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const AGORA = new Date().toISOString();

let atualizadoEm = PARADO_HA_30_DIAS;
let clienteId: string | null = null;
let dossie: DossieCliente | null = null;

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
    clienteId,
    clienteCodigo: clienteId ? "CL-00042" : null,
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
vi.mock("@/lib/backoffice-api", () => ({
  fetchImoveisByCodigos: async () => ({}),
  fetchDossieCliente: async () => dossie,
}));

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

/**
 * O rodapé da Atividade tinha o composer do WhatsApp e a anotação escondida
 * atrás de um botão só de ícone — escrever ali mandava mensagem para o cliente
 * quando a intenção era registrar uma observação interna. Mensagem só com a
 * conversa aberta; anotação só sob o filtro "Anotações", porque campo de texto
 * embaixo de uma lista de mensagens é lido como resposta ao cliente.
 */
describe("Ficha do contato — anotação, não mensagem", () => {
  afterEach(cleanup);

  function campoDeAnotacao() {
    return screen.queryByLabelText("Nova anotação");
  }

  it("não permite enviar mensagem pela ficha", async () => {
    render(await renderizar());
    expect(screen.queryByRole("button", { name: "Enviar mensagem" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Mensagem para/)).not.toBeInTheDocument();
  });

  it("manda para a conversa quem quer falar com o contato", async () => {
    render(await renderizar());
    expect(screen.getByRole("link", { name: /Abrir conversa/ })).toHaveAttribute(
      "href",
      "/?c=contato-1",
    );
  });

  it("só oferece o campo de anotação no filtro Anotações", async () => {
    render(await renderizar());

    // "Tudo" é o filtro inicial.
    expect(campoDeAnotacao()).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mensagens" }));
    expect(campoDeAnotacao()).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Anotações" }));
    expect(campoDeAnotacao()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar anotação/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tudo" }));
    expect(campoDeAnotacao()).not.toBeInTheDocument();
  });

  it("mantém o atalho para a conversa em todos os filtros", async () => {
    render(await renderizar());
    for (const filtro of ["Mensagens", "Anotações", "Tudo"]) {
      fireEvent.click(screen.getByRole("button", { name: filtro }));
      expect(screen.getByRole("link", { name: /Abrir conversa/ })).toBeInTheDocument();
    }
  });
});

/**
 * O cliente achou a ficha poluída: um stepper de seis etapas ocupando a
 * largura toda e uma linha de "Próxima ação" que ninguém usava para decidir
 * nada. O status continua na tela — como badge, do tamanho de um badge.
 */
describe("Ficha do contato — o que saiu da tela", () => {
  afterEach(cleanup);

  it("não mostra mais o funil de seis etapas", async () => {
    render(await renderizar());
    // O stepper numerava as etapas de 1 a 6 e rotulava a atual.
    expect(screen.queryByText("Visita marcada")).not.toBeInTheDocument();
    expect(screen.queryByText("Documentação")).not.toBeInTheDocument();
  });

  it("não mostra mais a próxima ação", async () => {
    render(await renderizar());
    expect(screen.queryByText(/Próxima ação/)).not.toBeInTheDocument();
  });

  it("mantém o status do contato, que é o dado por trás do funil", async () => {
    render(await renderizar());
    expect(screen.getByText("Em atendimento")).toBeInTheDocument();
  });
});

/**
 * O que o sistema principal sabe, dentro da conversa: onde ele já visitou, o
 * que é dele e o que falta assinar/anexar. Sem cliente vinculado (ou sem a API
 * configurada) a seção inteira não existe — a tela já estava cheia.
 */
describe("Ficha do contato — dossiê do sistema", () => {
  afterEach(() => {
    cleanup();
    clienteId = null;
    dossie = null;
  });

  const DOSSIE_COMPLETO: DossieCliente = {
    clienteId: "cl-1",
    codigo: "CL-00042",
    nome: "Ana Prado",
    visitas: [
      {
        fichaId: "f1",
        imovelCodigo: "MB-00033",
        imovelEndereco: "Rua A, 10",
        imovelBairro: "Centro",
        status: "assinada",
        assinadaEm: "2026-07-01T10:00:00Z",
        createdAt: "2026-06-30T10:00:00Z",
      },
      {
        fichaId: "f2",
        imovelCodigo: "MB-00099",
        imovelEndereco: "Rua B, 20",
        imovelBairro: "Praia",
        status: "emitida",
        assinadaEm: null,
        createdAt: "2026-07-10T10:00:00Z",
      },
    ],
    imoveisProprietario: [
      {
        imovelId: "im-1",
        codigo: "MB-00042",
        titulo: "Cobertura",
        bairro: "Praia",
        disponibilidade: "disponivel",
        documentos: [{ tipo: "matricula", nomeArquivo: "matricula.pdf", createdAt: null }],
        autorizacao: {
          autorizacaoId: "a1",
          tipoNegocio: "venda",
          status: "assinada",
          assinadaEm: "2026-03-01T00:00:00Z",
        },
      },
    ],
  };

  it("não renderiza a seção quando o contato não é cliente do sistema", async () => {
    render(await renderizar());
    expect(screen.queryByText("No sistema")).not.toBeInTheDocument();
  });

  it("não renderiza a seção quando o cliente não tem visita nem imóvel", async () => {
    clienteId = "cl-1";
    dossie = { clienteId: "cl-1", codigo: "CL-00042", nome: "Ana Prado", visitas: [], imoveisProprietario: [] };
    render(await renderizar());
    expect(screen.queryByText("No sistema")).not.toBeInTheDocument();
  });

  it("lista os imóveis já visitados, separando assinada de pendente", async () => {
    clienteId = "cl-1";
    dossie = DOSSIE_COMPLETO;
    render(await renderizar());

    expect(screen.getByText("No sistema")).toBeInTheDocument();
    expect(screen.getByText("Já visitou")).toBeInTheDocument();
    expect(screen.getByText(/MB-00033/)).toBeInTheDocument();
    expect(screen.getByText(/Ficha assinada em/)).toBeInTheDocument();
    expect(screen.getByText(/MB-00099/)).toBeInTheDocument();
    expect(screen.getByText(/Ficha de visita pendente/)).toBeInTheDocument();
  });

  it("mostra de qual imóvel é proprietário, com autorização e documentos", async () => {
    clienteId = "cl-1";
    dossie = DOSSIE_COMPLETO;
    render(await renderizar());

    expect(screen.getByText("Proprietário de")).toBeInTheDocument();
    expect(screen.getByText(/MB-00042/)).toBeInTheDocument();
    expect(screen.getByText(/Autorização assinada em/)).toBeInTheDocument();
    expect(screen.getByText("Matrícula")).toBeInTheDocument();
  });

  it("aponta o que falta: sem autorização e sem documento anexado", async () => {
    clienteId = "cl-1";
    dossie = {
      ...DOSSIE_COMPLETO,
      visitas: [],
      imoveisProprietario: [
        { ...DOSSIE_COMPLETO.imoveisProprietario[0], documentos: [], autorizacao: null },
      ],
    };
    render(await renderizar());

    expect(screen.getByText("Sem autorização de intermediação")).toBeInTheDocument();
    expect(screen.getByText("Nenhum documento anexado")).toBeInTheDocument();
  });
});
