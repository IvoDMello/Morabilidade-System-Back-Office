import { describe, it, expect, vi, afterEach } from "vitest";
import {
  relativo,
  dataCurta,
  diasParado,
  parseMoeda,
  formatBRL,
  soDigitos,
  whatsappLink,
  maskTelefone,
  formatarTelefone,
} from "./format";

afterEach(() => vi.useRealTimers());

describe("parseMoeda", () => {
  it("retorna null para vazio/null/undefined", () => {
    expect(parseMoeda("")).toBeNull();
    expect(parseMoeda(null)).toBeNull();
    expect(parseMoeda(undefined)).toBeNull();
  });
  it("mantém number puro", () => {
    expect(parseMoeda(1234.56)).toBe(1234.56);
  });
  it("converte formato BR '1.234,56'", () => {
    expect(parseMoeda("1.234,56")).toBe(1234.56);
  });
  it("converte só vírgula '1234,5'", () => {
    expect(parseMoeda("1234,5")).toBe(1234.5);
  });
  it("converte formato com ponto decimal '1234.56'", () => {
    expect(parseMoeda("1234.56")).toBe(1234.56);
  });
  it("remove prefixo R$ e espaços", () => {
    expect(parseMoeda("R$ 2.000,00")).toBe(2000);
  });
  // Peculiaridade conhecida: texto sem dígitos é "limpo" para "" e Number("") === 0.
  // Não é null. Documentado aqui para travar o comportamento atual.
  it("texto sem dígitos vira 0 (não null)", () => {
    expect(parseMoeda("abc")).toBe(0);
  });
});

describe("formatBRL", () => {
  it("retorna travessão para null", () => {
    expect(formatBRL(null)).toBe("—");
  });
  it("formata em reais", () => {
    expect(formatBRL(1234.56).replace(/ /g, " ")).toBe("R$ 1.234,56");
  });
  it("formata zero", () => {
    expect(formatBRL(0).replace(/ /g, " ")).toBe("R$ 0,00");
  });
});

describe("soDigitos", () => {
  it("extrai só dígitos", () => {
    expect(soDigitos("(11) 98888-7777")).toBe("11988887777");
  });
  it("retorna vazio para null", () => {
    expect(soDigitos(null)).toBe("");
  });
});

describe("whatsappLink", () => {
  it("retorna null sem número", () => {
    expect(whatsappLink(null)).toBeNull();
    expect(whatsappLink("")).toBeNull();
  });
  it("prefixa 55 para 11 dígitos", () => {
    expect(whatsappLink("11988887777")).toBe("https://wa.me/5511988887777");
  });
  it("prefixa 55 para 10 dígitos", () => {
    expect(whatsappLink("1133334444")).toBe("https://wa.me/551133334444");
  });
  it("não duplica 55 quando já vem com código do país", () => {
    expect(whatsappLink("5511988887777")).toBe("https://wa.me/5511988887777");
  });
  it("ignora máscara", () => {
    expect(whatsappLink("(11) 98888-7777")).toBe("https://wa.me/5511988887777");
  });
});

describe("maskTelefone", () => {
  it("vazio", () => expect(maskTelefone("")).toBe(""));
  it("dois dígitos abre DDD", () => expect(maskTelefone("11")).toBe("(11"));
  it("celular completo", () => expect(maskTelefone("11988887777")).toBe("(11) 98888-7777"));
  it("fixo completo", () => expect(maskTelefone("1133334444")).toBe("(11) 3333-4444"));
  it("remove 55 inicial", () => expect(maskTelefone("5511988887777")).toBe("(11) 98888-7777"));
  it("trunca excesso", () => expect(maskTelefone("119888877771234")).toBe("(11) 98888-7777"));
});

describe("formatarTelefone", () => {
  it("celular 11 dígitos", () => expect(formatarTelefone("11988887777")).toBe("(11) 98888-7777"));
  it("fixo 10 dígitos", () => expect(formatarTelefone("1133334444")).toBe("(11) 3333-4444"));
  it("remove 55 inicial", () => expect(formatarTelefone("5511988887777")).toBe("(11) 98888-7777"));
  it("retorna original se formato inesperado", () => expect(formatarTelefone("123")).toBe("123"));
  it("null vira vazio", () => expect(formatarTelefone(null)).toBe(""));
});

describe("dataCurta", () => {
  it("null vira travessão", () => expect(dataCurta(null)).toBe("—"));
  it("formata dd/mm", () => expect(dataCurta("2026-03-09T12:00:00.000Z")).toMatch(/^\d{2}\/\d{2}$/));
});

describe("diasParado", () => {
  it("conta dias inteiros desde a data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T00:00:00.000Z"));
    expect(diasParado("2026-06-18T00:00:00.000Z")).toBe(3);
  });
  it("mesmo dia é zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T10:00:00.000Z"));
    expect(diasParado("2026-06-21T00:00:00.000Z")).toBe(0);
  });
});

describe("relativo", () => {
  it("'agora' para diferença < 1 min", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    expect(relativo("2026-06-21T11:59:45.000Z")).toBe("agora");
  });
  it("usa minutos/horas/dias conforme a distância", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    expect(relativo("2026-06-21T11:30:00.000Z")).toContain("min");
    expect(relativo("2026-06-21T09:00:00.000Z")).toContain("h");
    expect(relativo("2026-06-18T12:00:00.000Z")).toContain("dia");
  });
});
