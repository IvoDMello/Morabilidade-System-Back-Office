import { describe, it, expect } from "vitest";
import { formatarMoeda, formatarArea } from "@/lib/utils";

describe("formatarMoeda", () => {
  it("formata valor em reais corretamente", () => {
    expect(formatarMoeda(500_000)).toMatch(/500\.000/);
    expect(formatarMoeda(500_000)).toMatch(/R\$/);
  });

  it("formata centavos corretamente", () => {
    expect(formatarMoeda(1_500.5)).toMatch(/1\.500/);
  });

  it("retorna traço para null", () => {
    expect(formatarMoeda(null)).toBe("—");
  });

  it("retorna traço para undefined", () => {
    expect(formatarMoeda(undefined)).toBe("—");
  });

  it("formata zero corretamente", () => {
    expect(formatarMoeda(0)).toMatch(/R\$/);
    expect(formatarMoeda(0)).toMatch(/0/);
  });
});

describe("formatarArea", () => {
  it("formata área com m²", () => {
    expect(formatarArea(80)).toContain("80");
    expect(formatarArea(80)).toContain("m²");
  });

  it("formata áreas decimais", () => {
    expect(formatarArea(72.5)).toContain("72");
  });

  it("retorna traço para null", () => {
    expect(formatarArea(null)).toBe("—");
  });

  it("retorna traço para undefined", () => {
    expect(formatarArea(undefined)).toBe("—");
  });
});
