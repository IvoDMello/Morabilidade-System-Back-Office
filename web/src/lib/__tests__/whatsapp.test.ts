import { describe, it, expect } from "vitest";
import { whatsappLink } from "../whatsapp";

const IMOVEL_BASE = {
  codigo: "IMO-00001",
  bairro: "Pinheiros",
  cidade: "São Paulo",
  tipo_imovel: "apartamento",
  tipo_negocio: "venda",
  dormitorios: 3,
  valor_venda: 1_500_000,
  valor_locacao: null,
};

describe("whatsappLink", () => {
  it("gera URL com número limpo (sem máscara)", () => {
    const url = whatsappLink("(11) 99999-8888", IMOVEL_BASE);
    expect(url).toContain("wa.me/11999998888");
  });

  it("inclui o código do imóvel na mensagem", () => {
    const url = whatsappLink("11999998888", IMOVEL_BASE);
    expect(decodeURIComponent(url)).toContain("IMO-00001");
  });

  it("exibe label legível para tipo de imóvel", () => {
    const url = whatsappLink("11999998888", IMOVEL_BASE);
    expect(decodeURIComponent(url)).toContain("Apartamento");
  });

  it("usa valor_locacao quando tipo_negocio é locacao", () => {
    const imovel = { ...IMOVEL_BASE, tipo_negocio: "locacao", valor_locacao: 4_500, valor_venda: null };
    const url = whatsappLink("11999998888", imovel);
    const msg = decodeURIComponent(url);
    expect(msg).toContain("4.500");
  });

  it("usa valor_venda quando tipo_negocio é venda", () => {
    const url = whatsappLink("11999998888", IMOVEL_BASE);
    const msg = decodeURIComponent(url);
    expect(msg).toContain("1.500.000");
  });

  it("omite valor quando não informado", () => {
    const imovel = { ...IMOVEL_BASE, valor_venda: null, valor_locacao: null };
    const url = whatsappLink("11999998888", imovel);
    expect(decodeURIComponent(url)).not.toContain("R$");
  });

  it("omite dormitórios quando não informado", () => {
    const imovel = { ...IMOVEL_BASE, dormitorios: null };
    const url = whatsappLink("11999998888", imovel);
    expect(decodeURIComponent(url)).not.toContain("dorm");
  });

  it("inclui cidade e bairro no local", () => {
    const url = whatsappLink("11999998888", IMOVEL_BASE);
    const msg = decodeURIComponent(url);
    expect(msg).toContain("Pinheiros, São Paulo");
  });

  it("usa só bairro quando cidade não está disponível", () => {
    const imovel = { ...IMOVEL_BASE, cidade: null };
    const url = whatsappLink("11999998888", imovel);
    const msg = decodeURIComponent(url);
    expect(msg).toContain("Pinheiros");
    expect(msg).not.toContain("null");
  });

  it("usa fallback 'Imóvel' para tipo desconhecido", () => {
    const imovel = { ...IMOVEL_BASE, tipo_imovel: "tipo_novo_desconhecido" };
    const url = whatsappLink("11999998888", imovel);
    expect(decodeURIComponent(url)).toContain("tipo_novo_desconhecido");
  });

  it("usa 'Imóvel' quando tipo_imovel é nulo", () => {
    const imovel = { ...IMOVEL_BASE, tipo_imovel: null };
    const url = whatsappLink("11999998888", imovel);
    expect(decodeURIComponent(url)).toContain("Imóvel");
  });
});
