import { describe, it, expect } from "vitest";
import { captacoesDoTelefone, nomeDoProprietario, telNormalizado } from "./telefone-cadastrado";
import type { Captacao } from "@/types";

function card(p: Partial<Captacao>): Captacao {
  return {
    id: "c1",
    endereco: "Rua A, 1",
    status: "novas",
    ordem: 0,
    whatsapp: null,
    proprietario_nome: null,
    criado_em: "2026-01-01T10:00:00Z",
    ...p,
  } as Captacao;
}

describe("telNormalizado", () => {
  it("tira máscara e DDI", () => {
    expect(telNormalizado("(81) 98888-7777")).toBe("81988887777");
    expect(telNormalizado("+55 81 98888-7777")).toBe("81988887777");
    expect(telNormalizado("5581988887777")).toBe("81988887777");
  });

  it("preserva número estrangeiro e vazio", () => {
    expect(telNormalizado("+351962620415")).toBe("351962620415");
    expect(telNormalizado(null)).toBe("");
  });
});

describe("captacoesDoTelefone", () => {
  const cards = [
    card({ id: "a", whatsapp: "(81) 98888-7777", criado_em: "2026-01-01T10:00:00Z" }),
    card({ id: "b", whatsapp: "5581988887777", criado_em: "2026-03-01T10:00:00Z" }),
    card({ id: "c", whatsapp: "(81) 97777-6666" }),
    card({ id: "d", whatsapp: null }),
  ];

  it("acha o mesmo número em qualquer formato, mais recente primeiro", () => {
    expect(captacoesDoTelefone(cards, "81988887777").map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("não busca com número incompleto", () => {
    expect(captacoesDoTelefone(cards, "(81) 9888")).toEqual([]);
    expect(captacoesDoTelefone(cards, "")).toEqual([]);
    expect(captacoesDoTelefone(cards, null)).toEqual([]);
  });
});

describe("nomeDoProprietario", () => {
  it("pega o nome da mais recente que tem nome", () => {
    const achadas = [card({ id: "b", proprietario_nome: "  " }), card({ id: "a", proprietario_nome: "Ana" })];
    expect(nomeDoProprietario(achadas)).toBe("Ana");
    expect(nomeDoProprietario([card({})])).toBeNull();
  });
});
