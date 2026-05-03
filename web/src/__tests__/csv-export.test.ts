import { describe, it, expect } from "vitest";

// Helpers que replicam a lógica de montagem de params do frontend
function buildClienteExportParams(filtros: {
  nome?: string;
  email?: string;
  status?: string;
}): Record<string, string> {
  const params: Record<string, string> = {};
  if (filtros.nome) params.nome = filtros.nome;
  if (filtros.email) params.email = filtros.email;
  if (filtros.status) params.status = filtros.status;
  return params;
}

function buildImovelExportParams(filtros: {
  busca?: string;
  codigo?: string;
  tipo_negocio?: string;
  disponibilidade?: string;
  cidade?: string;
  bairro?: string;
  tipo_imovel?: string;
  preco_min?: string;
  preco_max?: string;
}): Record<string, string> {
  const params: Record<string, string> = {};
  const busca = filtros.busca || filtros.codigo;
  if (busca) params.codigo = busca;
  if (filtros.tipo_negocio) params.tipo_negocio = filtros.tipo_negocio;
  if (filtros.disponibilidade) params.disponibilidade = filtros.disponibilidade;
  if (filtros.cidade) params.cidade = filtros.cidade;
  if (filtros.bairro) params.bairro = filtros.bairro;
  if (filtros.tipo_imovel) params.tipo_imovel = filtros.tipo_imovel;
  if (filtros.preco_min) params.preco_min = filtros.preco_min;
  if (filtros.preco_max) params.preco_max = filtros.preco_max;
  return params;
}

describe("CSV export — params de clientes", () => {
  it("sem filtros retorna params vazio", () => {
    expect(buildClienteExportParams({})).toEqual({});
  });

  it("inclui nome quando preenchido", () => {
    expect(buildClienteExportParams({ nome: "Maria" })).toEqual({ nome: "Maria" });
  });

  it("inclui email e status juntos", () => {
    const p = buildClienteExportParams({ email: "x@y.com", status: "ativo" });
    expect(p).toEqual({ email: "x@y.com", status: "ativo" });
  });

  it("ignora campos vazios", () => {
    expect(buildClienteExportParams({ nome: "", email: "", status: "" })).toEqual({});
  });
});

describe("CSV export — params de imóveis", () => {
  it("sem filtros retorna params vazio", () => {
    expect(buildImovelExportParams({})).toEqual({});
  });

  it("inclui todos os filtros preenchidos", () => {
    const p = buildImovelExportParams({
      bairro: "Humaitá",
      tipo_negocio: "venda",
      disponibilidade: "disponivel",
      preco_min: "1000000",
      preco_max: "3000000",
    });
    expect(p.bairro).toBe("Humaitá");
    expect(p.tipo_negocio).toBe("venda");
    expect(p.disponibilidade).toBe("disponivel");
    expect(p.preco_min).toBe("1000000");
    expect(p.preco_max).toBe("3000000");
  });

  it("busca é mapeada para codigo", () => {
    const p = buildImovelExportParams({ busca: "IMO-00001" });
    expect(p.codigo).toBe("IMO-00001");
  });

  it("ignora campos vazios", () => {
    expect(buildImovelExportParams({ bairro: "", cidade: "" })).toEqual({});
  });
});
