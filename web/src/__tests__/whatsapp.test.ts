import { describe, it, expect } from "vitest";
import { whatsappLink } from "@/lib/whatsapp";

describe("whatsappLink", () => {
  it("limpa o telefone e gera URL wa.me correta", () => {
    const url = whatsappLink("(21) 99999-9999", { codigo: "IMO-00001", bairro: "Humaitá" });
    expect(url).toContain("wa.me/21999999999");
  });

  it("inclui tipo do imóvel no texto", () => {
    const url = decodeURIComponent(
      whatsappLink("21999999999", { codigo: "IMO-00001", bairro: "Humaitá", tipo_imovel: "apartamento" })
    );
    expect(url).toContain("Apartamento");
  });

  it("inclui dormitórios quando presentes", () => {
    const url = decodeURIComponent(
      whatsappLink("21999999999", { codigo: "IMO-00001", bairro: "Ipanema", dormitorios: 3 })
    );
    expect(url).toContain("3 dorm.");
  });

  it("usa valor_locacao para tipo_negocio locacao", () => {
    const url = decodeURIComponent(
      whatsappLink("21999999999", {
        codigo: "IMO-00002",
        bairro: "Leblon",
        tipo_negocio: "locacao",
        valor_locacao: 8000,
        valor_venda: 3000000,
      })
    );
    expect(url).toContain("8.000");
    expect(url).not.toContain("3.000.000");
  });

  it("usa valor_venda para tipo_negocio venda", () => {
    const url = decodeURIComponent(
      whatsappLink("21999999999", {
        codigo: "IMO-00003",
        bairro: "Botafogo",
        tipo_negocio: "venda",
        valor_venda: 2500000,
        valor_locacao: 5000,
      })
    );
    expect(url).toContain("2.500.000");
    expect(url).not.toContain("5.000");
  });

  it("inclui cidade quando fornecida", () => {
    const url = decodeURIComponent(
      whatsappLink("21999999999", {
        codigo: "IMO-00001",
        bairro: "Humaitá",
        cidade: "Rio de Janeiro",
      })
    );
    expect(url).toContain("Humaitá, Rio de Janeiro");
  });

  it("funciona sem campos opcionais", () => {
    const url = whatsappLink("21999999999", { codigo: "IMO-00001", bairro: "Centro" });
    expect(url).toContain("wa.me/21999999999");
    expect(url).toContain("IMO-00001");
    expect(url).toContain("Centro");
  });

  it("inclui o código do imóvel no texto", () => {
    const url = decodeURIComponent(
      whatsappLink("21999999999", { codigo: "IMO-00042", bairro: "Flamengo" })
    );
    expect(url).toContain("IMO-00042");
  });
});
