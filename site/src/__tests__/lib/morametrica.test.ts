import { describe, it, expect } from "vitest";
import {
  comFiltros,
  descreverPeriodo,
  formatarArea,
  formatarM2,
  formatarMes,
  formatarMesExtenso,
  formatarValor,
  lerParametros,
  linkWhatsAppAvaliacao,
  novaBusca,
  plural,
  temBusca,
  urlMoraMetrica,
} from "@/lib/morametrica";

describe("lerParametros", () => {
  it("lê só os parâmetros conhecidos, sem espaços nem vazios", () => {
    expect(
      lerParametros({ q: "  Vieira Souto 510 ", tipologia: "", outro: "x", pagina: ["2", "3"] }),
    ).toEqual({ q: "Vieira Souto 510", pagina: "2" });
  });

  it("corta textos longos demais", () => {
    expect(lerParametros({ q: "a".repeat(500) }).q).toHaveLength(120);
  });
});

describe("temBusca", () => {
  it.each([
    [{ q: "Leblon" }, true],
    [{ cl: "83360" }, true],
    [{ bairro: "IPANEMA" }, true],
    [{ tipologia: "APARTAMENTO" }, false],
    [{}, false],
  ])("%o → %s", (params, esperado) => {
    expect(temBusca(params)).toBe(esperado);
  });
});

describe("URLs", () => {
  it("monta a URL na ordem fixa dos parâmetros", () => {
    expect(urlMoraMetrica({ pagina: "2", q: "Vieira Souto 510" })).toBe(
      "/morametrica?q=Vieira+Souto+510&pagina=2",
    );
    expect(urlMoraMetrica({})).toBe("/morametrica");
  });

  it("mudar filtro volta para a página 1 e mantém o resto", () => {
    const params = { q: "Ipanema", desde: "2017", pagina: "3" };
    expect(comFiltros(params, { tipologia: "APARTAMENTO" })).toBe(
      "/morametrica?q=Ipanema&tipologia=APARTAMENTO&desde=2017",
    );
    expect(comFiltros(params, { desde: undefined, todo_periodo: "true" })).toBe(
      "/morametrica?q=Ipanema&todo_periodo=true",
    );
  });

  it("nova busca descarta os filtros", () => {
    expect(novaBusca({ cl: "83360", numero: "510", q: "Avenida Vieira Souto, 510" })).toBe(
      "/morametrica?q=Avenida+Vieira+Souto%2C+510&cl=83360&numero=510",
    );
  });
});

describe("formatação", () => {
  it("mês da competência", () => {
    expect(formatarMes("2026-07-01")).toBe("jul/2026");
    expect(formatarMesExtenso("2026-09-01")).toBe("setembro de 2026");
  });

  it("valores, m² e área", () => {
    expect(formatarValor(5300000)).toBe("R$ 5.300.000");
    expect(formatarM2(58281.86)).toBe("R$ 58.282/m²");
    expect(formatarArea(93.5)).toBe("94 m²");
    expect(formatarM2(null)).toBe("Sem dado");
    expect(formatarValor(undefined)).toBe("Sem dado");
  });

  it("plural", () => {
    expect(plural(1, "venda", "vendas")).toBe("1 venda");
    expect(plural(1442, "venda", "vendas")).toBe("1.442 vendas");
  });

  it("período", () => {
    expect(descreverPeriodo({ desde: "2021-10-01" }, "2026-09-01")).toBe("de out/2021 a set/2026");
    expect(descreverPeriodo({ desde: "2015-01-01", ate: "2018-12-01" }, "2026-09-01")).toBe(
      "de jan/2015 a dez/2018",
    );
    expect(descreverPeriodo({}, "2026-09-01")).toBe("de 2011 a set/2026");
  });
});

describe("linkWhatsAppAvaliacao", () => {
  it("cita o endereço buscado", () => {
    const link = linkWhatsAppAvaliacao("5521997729990", "Avenida Vieira Souto, 510");
    expect(link.startsWith("https://wa.me/5521997729990?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("vendas em Avenida Vieira Souto, 510");
  });

  it("sem número configurado usa o link curto da empresa", () => {
    expect(linkWhatsAppAvaliacao("", null)).toBe("https://wa.link/we06jw");
  });
});
