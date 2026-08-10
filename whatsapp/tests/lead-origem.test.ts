import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dataSource } from "@/services/data";
import { mockStore } from "@/services/data/mock/store";
import { extrairCodigoImovel, pareceLeadDoSite } from "@/lib/imovel-codigo";
import { nomeEhPlaceholder, qualificaParaCliente } from "@/services/clientes.service";
import { registrarRastroDaMensagem } from "@/services/lead-origem.service";

/**
 * Ciclo de dados do lead: o que a primeira mensagem já traz de graça.
 *
 * O botão do site público injeta "(código *MB-00033*)" no texto. Antes isso
 * chegava e morria no corpo da conversa: ninguém sabia de qual imóvel o lead
 * falava, e a origem — escrita na própria mensagem — se perdia.
 */

const ENV_ORIGINAL = {
  url: process.env.BACKOFFICE_API_URL,
  token: process.env.BACKOFFICE_INTERNAL_TOKEN,
};

const MENSAGEM_DO_SITE =
  "Olá! Tenho interesse no imóvel *Cobertura em Ipanema* (código *MB-00033*). Pode me dar mais informações?";

/** API principal respondendo ao lookup de imóvel, à busca de cliente e ao upsert. */
function stubApi(options: { imovelExiste?: boolean; clienteExiste?: boolean } = {}) {
  const { imovelExiste = true, clienteExiste = false } = options;
  const chamadas: string[] = [];

  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    chamadas.push(url);

    if (url.includes("/imoveis/interno/")) {
      if (!imovelExiste) return new Response("não encontrado", { status: 404 });
      return Response.json({
        id: "imovel-uuid-1",
        codigo: "MB-00033",
        titulo: "Cobertura em Ipanema",
        bairro: "Ipanema",
      });
    }
    if (url.includes("/clientes/interno/por-telefone/")) {
      return Response.json(
        clienteExiste ? { id: "cliente-existente", codigo: "CL-00001", nome_completo: "Ana" } : null,
      );
    }
    if (url.includes("/clientes/interno/upsert-por-telefone")) {
      return Response.json({
        id: "cliente-novo",
        codigo: "CL-00099",
        nome_completo: "Ana Souza",
        criado: true,
      });
    }
    throw new Error(`URL inesperada no teste: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, chamadas };
}

async function criarContato(nome = "Ana Souza") {
  return dataSource.contacts.create({
    name: nome,
    phone: "5521970001111",
    category: "comprador",
    status: "novo",
    nextAction: "ligar",
  });
}

beforeEach(() => {
  process.env.BACKOFFICE_API_URL = "https://api.exemplo.test";
  process.env.BACKOFFICE_INTERNAL_TOKEN = "token-de-teste";
  mockStore.contacts.length = 0;
  mockStore.properties.length = 0;
  mockStore.contactProperties.length = 0;
  mockStore.events.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.BACKOFFICE_API_URL = ENV_ORIGINAL.url;
  process.env.BACKOFFICE_INTERNAL_TOKEN = ENV_ORIGINAL.token;
});

describe("reconhecimento do código", () => {
  it("acha o código na mensagem do botão do site", () => {
    expect(extrairCodigoImovel(MENSAGEM_DO_SITE)).toBe("MB-00033");
  });

  it("aceita minúsculas e devolve em caixa alta", () => {
    expect(extrairCodigoImovel("tenho interesse no mb-00033")).toBe("MB-00033");
  });

  it("texto sem código não inventa nada", () => {
    expect(extrairCodigoImovel("Oi, tudo bem?")).toBeNull();
    expect(extrairCodigoImovel(null)).toBeNull();
  });

  it("reconhece a assinatura do site, distinta de um código citado solto", () => {
    expect(pareceLeadDoSite(MENSAGEM_DO_SITE)).toBe(true);
    expect(pareceLeadDoSite("vi o MB-00033 no instagram")).toBe(false);
  });
});

describe("regra de promoção a cliente", () => {
  it("nome gerado a partir do telefone não vira cadastro", () => {
    // Sem profile_name da Meta, o CRM nomeia o contato com o telefone
    // formatado. Criar cliente assim encheria a base de "(21) 97195-7245".
    expect(nomeEhPlaceholder("(21) 97000-1111", "5521970001111")).toBe(true);
    expect(nomeEhPlaceholder("+55 21 97000-1111", "5521970001111")).toBe(true);
    expect(nomeEhPlaceholder("Ana Souza", "5521970001111")).toBe(false);
  });

  it("contato já vinculado não é promovido de novo", () => {
    const base = { id: "c1", name: "Ana Souza", phone: "5521970001111" };
    expect(qualificaParaCliente({ ...base, clienteId: null })).toBe(true);
    expect(qualificaParaCliente({ ...base, clienteId: "cliente-1" })).toBe(false);
  });
});

describe("rastro da mensagem", () => {
  it("vincula o imóvel e cria o cliente com origem 'site'", async () => {
    const { chamadas } = stubApi();
    const contato = await criarContato();

    const rastro = await registrarRastroDaMensagem(contato, MENSAGEM_DO_SITE);

    expect(rastro).toEqual({
      imovelCodigo: "MB-00033",
      vinculouImovel: true,
      criouCliente: true,
    });

    const vinculados = await dataSource.properties.listByContact(contato.id);
    expect(vinculados).toHaveLength(1);
    expect(vinculados[0].code).toBe("MB-00033");
    // O título vem do catálogo real, não do texto da mensagem.
    expect(vinculados[0].title).toBe("Cobertura em Ipanema");

    const upsert = chamadas.find((u) => u.includes("upsert-por-telefone"));
    expect(upsert).toBeDefined();
  });

  it("grava o vínculo do cliente no contato", async () => {
    stubApi();
    const contato = await criarContato();

    await registrarRastroDaMensagem(contato, MENSAGEM_DO_SITE);

    const atualizado = await dataSource.contacts.getById(contato.id);
    expect(atualizado?.clienteId).toBe("cliente-novo");
    expect(atualizado?.clienteCodigo).toBe("CL-00099");
  });

  it("registra o vínculo na timeline do contato", async () => {
    stubApi();
    const contato = await criarContato();

    await registrarRastroDaMensagem(contato, MENSAGEM_DO_SITE);

    const eventos = await dataSource.events.listByContact(contato.id);
    expect(eventos.some((e) => e.type === "property_linked")).toBe(true);
  });

  it("código inexistente no catálogo não vira imóvel fantasma", async () => {
    // É a consulta à API — não o formato do texto — que decide.
    stubApi({ imovelExiste: false });
    const contato = await criarContato();

    const rastro = await registrarRastroDaMensagem(contato, "sobre o CEP-01234");

    expect(rastro.vinculouImovel).toBe(false);
    expect(await dataSource.properties.listByContact(contato.id)).toHaveLength(0);
  });

  it("citar o mesmo código de novo não duplica o vínculo", async () => {
    stubApi();
    const contato = await criarContato();

    await registrarRastroDaMensagem(contato, MENSAGEM_DO_SITE);
    const segunda = await registrarRastroDaMensagem(
      await dataSource.contacts.getById(contato.id).then((c) => c!),
      "ainda sobre o MB-00033, qual o valor?",
    );

    expect(segunda.vinculouImovel).toBe(false);
    expect(await dataSource.properties.listByContact(contato.id)).toHaveLength(1);
  });

  it("cliente que já existe é reaproveitado, não recriado", async () => {
    const { chamadas } = stubApi({ clienteExiste: true });
    const contato = await criarContato();

    const rastro = await registrarRastroDaMensagem(contato, MENSAGEM_DO_SITE);

    expect(rastro.criouCliente).toBe(false);
    expect(chamadas.some((u) => u.includes("upsert-por-telefone"))).toBe(false);
    expect((await dataSource.contacts.getById(contato.id))?.clienteId).toBe("cliente-existente");
  });

  it("contato sem nome real ganha o imóvel, mas não vira cadastro", async () => {
    stubApi();
    const contato = await criarContato("(21) 97000-1111");

    const rastro = await registrarRastroDaMensagem(contato, MENSAGEM_DO_SITE);

    expect(rastro.vinculouImovel).toBe(true);
    expect(rastro.criouCliente).toBe(false);
  });

  it("sem integração configurada, não faz nada e não quebra", async () => {
    delete process.env.BACKOFFICE_API_URL;
    const contato = await criarContato();

    const rastro = await registrarRastroDaMensagem(contato, MENSAGEM_DO_SITE);

    expect(rastro.imovelCodigo).toBeNull();
    expect(await dataSource.properties.listByContact(contato.id)).toHaveLength(0);
  });

  it("API fora do ar não derruba o processamento da mensagem", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }));
    const contato = await criarContato();

    await expect(
      registrarRastroDaMensagem(contato, MENSAGEM_DO_SITE),
    ).resolves.toMatchObject({ vinculouImovel: false });
  });
});
