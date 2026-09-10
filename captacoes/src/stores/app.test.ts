import { describe, it, expect, beforeEach } from "vitest";
import { useApp } from "./app";
import { CRITERIOS_VAZIO } from "@/types";
import type { CaptacaoLista, Lista } from "@/types";

const lista = (id: string, ordem: number): Lista =>
  ({ id, nome: `Lista ${id}`, cor: "cinza", permanente: false, ordem }) as Lista;

const vinculo = (captacao_id: string, lista_id: string): CaptacaoLista =>
  ({ captacao_id, lista_id, ordem: 0, criado_em: "" }) as CaptacaoLista;

beforeEach(() => {
  useApp.setState({
    listas: [lista("a", 10), lista("b", 20)],
    vinculos: [vinculo("c1", "a"), vinculo("c2", "b")],
    listaAtiva: null,
    criterios: CRITERIOS_VAZIO,
  });
});

describe("removerLista não deixa referência órfã", () => {
  it("tira a lista e os vínculos, sem tocar nas captações", () => {
    useApp.getState().removerLista("a");
    expect(useApp.getState().listas.map((l) => l.id)).toEqual(["b"]);
    expect(useApp.getState().vinculos.map((v) => v.lista_id)).toEqual(["b"]);
  });

  it("desliga a lista ativa quando é ela que foi apagada", () => {
    useApp.setState({ listaAtiva: "a" });
    useApp.getState().removerLista("a");
    expect(useApp.getState().listaAtiva).toBeNull();
  });

  it("preserva a lista ativa quando quem morreu foi outra", () => {
    useApp.setState({ listaAtiva: "b" });
    useApp.getState().removerLista("a");
    expect(useApp.getState().listaAtiva).toBe("b");
  });

  it("tira o id morto do filtro de listas", () => {
    // Sem isto o filtro continuava ativo apontando para uma lista inexistente:
    // nenhuma captação casava e o chip para desfazer saia em branco.
    useApp.setState({ criterios: { ...CRITERIOS_VAZIO, listas: ["a", "b"] } });
    useApp.getState().removerLista("a");
    expect(useApp.getState().criterios.listas).toEqual(["b"]);
  });
});

describe("reconciliarListas (recarga vinda do realtime)", () => {
  it("troca listas e vínculos pelo que veio do servidor", () => {
    useApp.getState().reconciliarListas([lista("b", 20)], [vinculo("c2", "b")]);
    expect(useApp.getState().listas.map((l) => l.id)).toEqual(["b"]);
    expect(useApp.getState().vinculos).toHaveLength(1);
  });

  it("solta a lista ativa que outra pessoa apagou", () => {
    // O caminho do realtime não passa por removerLista: sem reconciliar aqui,
    // a aba de quem estava com a lista aberta ficava vazia e sem pill acesa.
    useApp.setState({ listaAtiva: "a" });
    useApp.getState().reconciliarListas([lista("b", 20)], []);
    expect(useApp.getState().listaAtiva).toBeNull();
  });

  it("mantém a lista ativa que continua existindo", () => {
    useApp.setState({ listaAtiva: "b" });
    useApp.getState().reconciliarListas([lista("a", 10), lista("b", 20)], []);
    expect(useApp.getState().listaAtiva).toBe("b");
  });

  it("limpa do filtro só os ids que sumiram", () => {
    useApp.setState({ criterios: { ...CRITERIOS_VAZIO, listas: ["a", "b"] } });
    useApp.getState().reconciliarListas([lista("b", 20)], []);
    expect(useApp.getState().criterios.listas).toEqual(["b"]);
  });

  it("não reescreve os critérios quando nada sumiu", () => {
    const antes = { ...CRITERIOS_VAZIO, listas: ["a"] };
    useApp.setState({ criterios: antes });
    useApp.getState().reconciliarListas([lista("a", 10)], []);
    expect(useApp.getState().criterios).toBe(antes);
  });
});
