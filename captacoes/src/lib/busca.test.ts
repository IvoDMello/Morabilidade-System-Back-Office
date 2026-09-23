import { describe, it, expect } from "vitest";
import { buscaGlobal, totalResultados } from "./busca";
import type { Captacao } from "@/types";

function card(p: Partial<Captacao>): Captacao {
  return {
    id: Math.random().toString(36),
    endereco: "",
    status: "novas",
    decisao: null,
    ordem: 0,
    ...p,
  } as Captacao;
}

const base = [
  card({ endereco: "Rua das Flores, 100", status: "novas" }),
  card({ endereco: "Rua das Flores, 200", status: "pendente_agendar_visita" }),
  card({ endereco: "Rua das Flores, 300", status: "negativada" }),
  card({ endereco: "Rua das Flores, 400", status: "publicada" }),
  card({ endereco: "Av. Brasil, 500", status: "novas" }),
];

describe("buscaGlobal", () => {
  it("termo vazio não devolve nada", () => {
    expect(buscaGlobal(base, "")).toEqual([]);
    expect(buscaGlobal(base, "   ")).toEqual([]);
  });

  it("acha em todas as etapas, não só na aba aberta", () => {
    const grupos = buscaGlobal(base, "flores");
    expect(grupos.map((g) => g.etapa)).toEqual(["decidir", "aprovada", "negativada", "publicada"]);
    expect(totalResultados(grupos)).toBe(4);
  });

  it("mantém a ordem das abas", () => {
    const grupos = buscaGlobal([base[3], base[2], base[0]], "flores");
    expect(grupos.map((g) => g.etapa)).toEqual(["decidir", "negativada", "publicada"]);
  });

  it("tira a etapa que a tela já lista", () => {
    const grupos = buscaGlobal(base, "flores", "decidir");
    expect(grupos.map((g) => g.etapa)).toEqual(["aprovada", "negativada", "publicada"]);
    expect(totalResultados(grupos)).toBe(3);
  });

  it("não devolve grupo vazio quando a etapa não casa", () => {
    const grupos = buscaGlobal(base, "brasil");
    expect(grupos).toHaveLength(1);
    expect(grupos[0].etapa).toBe("decidir");
  });

  it("publicada não aponta para aba nenhuma", () => {
    const grupos = buscaGlobal(base, "flores");
    expect(grupos.find((g) => g.etapa === "publicada")?.href).toBeNull();
    expect(grupos.find((g) => g.etapa === "aprovada")?.href).toBe("/aprovadas");
  });

  it("engavetada sem decisão cai em Decidir, como na aba", () => {
    const grupos = buscaGlobal([card({ endereco: "Rua Z", status: "gaveta", decisao: null })], "rua z");
    expect(grupos.map((g) => g.etapa)).toEqual(["decidir"]);
  });
});
