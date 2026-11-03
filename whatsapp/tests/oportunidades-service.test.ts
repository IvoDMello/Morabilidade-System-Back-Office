import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImovelDisponivel, PreferenciaBusca, PreferenciaInput } from "@/types/oportunidade";

/**
 * Aba de Oportunidades: montagem do painel, gravação do perfil de busca e
 * registro do envio. ranquearImoveis e calcularJanela estão em
 * match-imovel.test.ts; aqui o que importa é o cruzamento e as falhas.
 */

const getContacts = vi.fn();
const garantirClienteDoContato = vi.fn();
const dataSource = {
  whatsapp: { listConversations: vi.fn() },
  contacts: { getById: vi.fn() },
  properties: {
    listByContacts: vi.fn(),
    listByContact: vi.fn(),
    create: vi.fn(),
    addToContact: vi.fn(),
  },
  events: { create: vi.fn() },
};
const mockStore = { imoveisSistema: [] as ImovelDisponivel[], preferencias: [] as PreferenciaBusca[] };
const supabase = { respostas: {} as Record<string, { data?: unknown; error?: unknown }>, chamadas: [] as unknown[][] };

vi.mock("@/services/data", () => ({ dataSource }));
vi.mock("@/services/contacts.service", () => ({ getContacts: (...a: unknown[]) => getContacts(...a) }));
vi.mock("@/services/clientes.service", () => ({
  garantirClienteDoContato: (...a: unknown[]) => garantirClienteDoContato(...a),
}));
vi.mock("@/services/data/mock/store", () => ({ mockStore }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseSistemaClient: () => ({
    from: (tabela: string) => {
      const passos: unknown[] = [tabela];
      supabase.chamadas.push(passos);
      const cadeia: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "upsert"]) {
        cadeia[m] = (...args: unknown[]) => {
          passos.push([m, ...args]);
          return cadeia;
        };
      }
      cadeia.then = (ok: (r: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null, ...supabase.respostas[tabela] }).then(ok);
      return cadeia;
    },
  }),
}));

async function servico(fonte: "mock" | "supabase" = "mock") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", fonte);
  return import("@/services/oportunidades.service");
}

const imovel = (campos: Partial<ImovelDisponivel> = {}): ImovelDisponivel => ({
  id: "im-1",
  codigo: "MB-00001",
  titulo: "Cobertura",
  cidade: "Rio de Janeiro",
  bairro: "Leblon",
  tipoImovel: "apartamento",
  tipoNegocio: "venda",
  andar: 10,
  valorVenda: 5_000_000,
  valorLocacao: null,
  dormitorios: 3,
  vagasGaragem: 2,
  fotoCapa: null,
  ...campos,
});

const pref = (clienteId: string, campos: Partial<PreferenciaBusca> = {}): PreferenciaBusca => ({
  clienteId,
  tipoNegocio: "venda",
  tipoImovel: "apartamento",
  cidade: "Rio de Janeiro",
  bairros: ["Leblon"],
  valorMin: null,
  valorMax: 6_000_000,
  dormitoriosMin: 2,
  vagasGaragemMin: null,
  observacoes: null,
  origem: "manual",
  atualizadaEm: null,
  ...campos,
});

const contato = (id: string, campos: Record<string, unknown> = {}) => ({
  id,
  name: `Contato ${id}`,
  phone: "5521999990000",
  category: "comprador",
  status: "em_atendimento",
  isBlocked: false,
  clienteId: null,
  clienteCodigo: null,
  ...campos,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockStore.imoveisSistema = [];
  mockStore.preferencias = [];
  supabase.respostas = {};
  supabase.chamadas = [];
  dataSource.whatsapp.listConversations.mockResolvedValue([]);
  dataSource.properties.listByContacts.mockResolvedValue(new Map());
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("getPainelOportunidades", () => {
  it("cruza catálogo e perfis, tira bloqueados e encerrados e ordena por oportunidade", async () => {
    mockStore.imoveisSistema = [imovel()];
    mockStore.preferencias = [pref("cli-a"), pref("cli-z", { bairros: ["Barra"], valorMax: 100 })];
    getContacts.mockResolvedValue([
      contato("sem-perfil"),
      contato("z", { clienteId: "cli-z" }),
      contato("a", { clienteId: "cli-a" }),
      contato("bloqueado", { clienteId: "cli-a", isBlocked: true }),
      contato("perdido", { clienteId: "cli-a", status: "perdido" }),
    ]);
    dataSource.whatsapp.listConversations.mockResolvedValue([
      { contactId: "a", lastInboundAt: new Date().toISOString() },
    ]);
    dataSource.properties.listByContacts.mockResolvedValue(new Map([["a", [{ code: "mb-00001" }]]]));

    const { getPainelOportunidades } = await servico();
    const painel = await getPainelOportunidades();

    expect(painel.itens.map((i) => i.contactId)).toEqual(["a", "z", "sem-perfil"]);
    const [a] = painel.itens;
    expect(a.compativeis).toBe(1);
    expect(a.imoveis[0].jaEnviado).toBe(true);
    expect(a.janela.aberta).toBe(true);
    expect(painel).toMatchObject({ totalImoveis: 1, semPerfil: 1, catalogoDisponivel: true });
  });

  it("catálogo fora do ar ainda mostra os contatos e avisa", async () => {
    getContacts.mockResolvedValue([contato("a", { clienteId: "cli-a" })]);
    supabase.respostas.imoveis = { error: { message: "timeout" } };

    const { getPainelOportunidades } = await servico("supabase");
    const painel = await getPainelOportunidades();

    expect(painel.catalogoDisponivel).toBe(false);
    expect(painel.itens).toHaveLength(1);
    expect(painel.totalImoveis).toBe(0);
  });

  it("vínculos indisponíveis não derrubam a aba", async () => {
    getContacts.mockResolvedValue([contato("a")]);
    dataSource.properties.listByContacts.mockRejectedValue(new Error("rls"));
    const { getPainelOportunidades } = await servico();
    expect((await getPainelOportunidades()).itens[0].codigosDeInteresse).toEqual([]);
  });

  it("no Supabase lê só imóveis disponíveis e preferências ativas, mapeando as colunas", async () => {
    getContacts.mockResolvedValue([contato("a", { clienteId: "cli-a" }), contato("b", { clienteId: "cli-a" })]);
    supabase.respostas.imoveis = {
      data: [
        {
          id: "im-1", codigo: "MB-00001", titulo: null, cidade: "Rio de Janeiro", bairro: "Leblon",
          tipo_imovel: "apartamento", tipo_negocio: "venda", andar: "7", valor_venda: "5000000",
          valor_locacao: null, dormitorios: 3, vagas_garagem: null,
          imovel_fotos: [{ url: "b.jpg", ordem: 2 }, { url: "a.jpg", ordem: 1 }],
        },
      ],
    };
    supabase.respostas.cliente_preferencias = {
      data: [{ cliente_id: "cli-a", tipo_negocio: "venda", tipo_imovel: null, cidade: null, bairros: null,
               valor_min: null, valor_max: "6000000", dormitorios_min: null, vagas_garagem_min: null,
               observacoes: null, origem: "manual", updated_at: null }],
    };

    const { getPainelOportunidades } = await servico("supabase");
    const painel = await getPainelOportunidades();

    expect(painel.totalImoveis).toBe(1);
    expect(painel.itens[0].preferencia?.valorMax).toBe(6_000_000);
    expect(painel.itens[0].imoveis[0]).toMatchObject({ andar: 7, valorVenda: 5_000_000 });
    const [imoveis, prefs] = supabase.chamadas as unknown[][];
    expect(imoveis).toContainEqual(["eq", "disponibilidade", "disponivel"]);
    expect(prefs).toContainEqual(["in", "cliente_id", ["cli-a"]]);
  });
});

describe("salvarPreferencia", () => {
  const entrada = (campos: Partial<PreferenciaInput> = {}): PreferenciaInput => ({
    tipoNegocio: " venda ",
    tipoImovel: "",
    cidade: "Rio de Janeiro",
    bairros: [" Leblon ", "", "Ipanema"],
    valorMin: null,
    valorMax: 3_000_000,
    dormitoriosMin: 2,
    vagasGaragemMin: null,
    observacoes: "  ",
    ...campos,
  });

  it("contato inexistente e faixa de valor invertida são recusados", async () => {
    const { salvarPreferencia } = await servico();
    dataSource.contacts.getById.mockResolvedValue(null);
    expect(await salvarPreferencia("x", entrada())).toEqual({ ok: false, erro: "Contato não encontrado." });

    dataSource.contacts.getById.mockResolvedValue(contato("a", { clienteId: "cli-a" }));
    expect((await salvarPreferencia("a", entrada({ valorMin: 5, valorMax: 1 }))).erro).toContain("mínimo");
  });

  it("contato sem cadastro vira cliente; sem nome de verdade é recusado", async () => {
    const { salvarPreferencia } = await servico();
    dataSource.contacts.getById.mockResolvedValue(contato("a"));
    garantirClienteDoContato.mockResolvedValueOnce(null);
    expect((await salvarPreferencia("a", entrada())).erro).toContain("ainda não é um cliente");

    garantirClienteDoContato.mockResolvedValueOnce({ clienteId: "cli-novo", criado: true });
    expect(await salvarPreferencia("a", entrada())).toEqual({ ok: true, clienteCriado: true });
    expect(mockStore.preferencias[0]).toMatchObject({
      clienteId: "cli-novo",
      tipoNegocio: "venda",
      tipoImovel: null,
      bairros: ["Leblon", "Ipanema"],
      observacoes: null,
      origem: "manual",
    });
  });

  it("no modo de exemplo substitui o perfil existente do cliente", async () => {
    const { salvarPreferencia } = await servico();
    mockStore.preferencias = [pref("cli-a")];
    dataSource.contacts.getById.mockResolvedValue(contato("a", { clienteId: "cli-a" }));
    await salvarPreferencia("a", entrada({ cidade: "Niterói" }));
    expect(mockStore.preferencias).toHaveLength(1);
    expect(mockStore.preferencias[0].cidade).toBe("Niterói");
  });

  it("no Supabase faz upsert por cliente_id e traduz o erro", async () => {
    const { salvarPreferencia } = await servico("supabase");
    dataSource.contacts.getById.mockResolvedValue(contato("a", { clienteId: "cli-a" }));
    expect(await salvarPreferencia("a", entrada())).toEqual({ ok: true, clienteCriado: false });
    const [upsert] = (supabase.chamadas[0] as unknown[][]).filter((p) => p[0] === "upsert");
    expect(upsert[1]).toMatchObject({ cliente_id: "cli-a", ativa: true, origem: "manual", bairros: ["Leblon", "Ipanema"] });
    expect(upsert[2]).toEqual({ onConflict: "cliente_id" });

    supabase.respostas.cliente_preferencias = { error: { message: "rls" } };
    expect((await salvarPreferencia("a", entrada())).erro).toContain("Não foi possível salvar");
  });
});

describe("registrarImoveisEnviados", () => {
  it("vincula cada imóvel e só gera evento na primeira vez", async () => {
    const { registrarImoveisEnviados } = await servico();
    dataSource.properties.create.mockImplementation(async ({ code }: { code: string }) => ({ id: `p-${code}` }));
    dataSource.properties.listByContact.mockResolvedValue([{ code: "mb-00001" }]);

    await registrarImoveisEnviados("a", [
      { codigo: "MB-00001", titulo: "Cobertura" },
      { codigo: "MB-00002", titulo: null },
    ]);

    expect(dataSource.properties.addToContact).toHaveBeenCalledTimes(2);
    expect(dataSource.events.create).toHaveBeenCalledTimes(1);
    expect(dataSource.events.create.mock.calls[0][0].summary).toContain("MB-00002");
  });

  it("falha num imóvel não impede os outros nem vira erro para quem enviou", async () => {
    const { registrarImoveisEnviados } = await servico();
    dataSource.properties.create.mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce({ id: "p-2" });
    dataSource.properties.listByContact.mockResolvedValue([]);
    await expect(
      registrarImoveisEnviados("a", [
        { codigo: "MB-1", titulo: null },
        { codigo: "MB-2", titulo: null },
      ]),
    ).resolves.toBeUndefined();
    expect(dataSource.properties.addToContact).toHaveBeenCalledTimes(1);
  });
});
