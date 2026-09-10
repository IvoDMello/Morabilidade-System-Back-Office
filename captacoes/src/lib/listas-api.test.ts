import { describe, it, expect } from "vitest";
import { motivo } from "./listas-api";

const PADRAO = "Não foi possível salvar a lista.";

describe("motivo: erro do banco vira frase acionável", () => {
  it("sem erro, devolve o padrão", () => {
    expect(motivo(null, PADRAO)).toBe(PADRAO);
  });

  it("nome duplicado diz que é o nome, na criação E na renomeada", () => {
    // Índice único de lower(trim(nome)) da 0021. Antes, renomear para um
    // nome existente caia no genérico e não dava para saber o que corrigir.
    expect(motivo({ code: "23505" }, PADRAO)).toBe("Já existe uma lista com esse nome.");
  });

  it("lista permanente: repassa a frase escrita pela trigger da 0024", () => {
    const msg = 'A lista "Gaveta" é permanente e não pode ser apagada.';
    expect(motivo({ code: "23001", message: msg }, PADRAO)).toBe(msg);
  });

  it("restrict_violation sem mensagem cai no padrão, não em undefined", () => {
    expect(motivo({ code: "23001" }, PADRAO)).toBe(PADRAO);
  });

  it("nome fora de 1..40 explica o limite", () => {
    expect(motivo({ code: "23514" }, PADRAO)).toBe("O nome precisa ter entre 1 e 40 caracteres.");
  });

  it("erro desconhecido não vaza jargão do Postgres para a tela", () => {
    expect(motivo({ code: "08006", message: "server closed the connection" }, PADRAO)).toBe(PADRAO);
  });
});
