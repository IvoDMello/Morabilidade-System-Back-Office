import { describe, it, expect, beforeEach } from "vitest";
import { useBoard } from "./board";
import type { Captacao, Status } from "@/types";

function card(id: string, status: Status, ordem: number, extra: Partial<Captacao> = {}): Captacao {
  return { id, endereco: `End ${id}`, status, ordem, ...extra } as Captacao;
}

beforeEach(() => {
  useBoard.setState({ byStatus: useBoard.getState().byStatus, filtro: "" });
  useBoard.getState().setCards([]);
});

describe("board store", () => {
  it("setCards agrupa por status e ordena por ordem", () => {
    useBoard.getState().setCards([
      card("a", "aguardando_informacoes", 20),
      card("b", "aguardando_informacoes", 10),
      card("c", "em_decisao", 5),
    ]);
    const bs = useBoard.getState().byStatus;
    expect(bs.aguardando_informacoes.map((c) => c.id)).toEqual(["b", "a"]);
    expect(bs.em_decisao.map((c) => c.id)).toEqual(["c"]);
  });

  it("find localiza por id", () => {
    useBoard.getState().setCards([card("a", "em_decisao", 1)]);
    expect(useBoard.getState().find("a")?.id).toBe("a");
    expect(useBoard.getState().find("zzz")).toBeUndefined();
  });

  it("upsert adiciona novo card", () => {
    useBoard.getState().upsert(card("a", "em_decisao", 1));
    expect(useBoard.getState().find("a")).toBeDefined();
  });

  it("upsert atualiza card existente sem duplicar", () => {
    useBoard.getState().setCards([card("a", "aguardando_informacoes", 1)]);
    useBoard.getState().upsert(card("a", "em_decisao", 1));
    const bs = useBoard.getState().byStatus;
    expect(bs.aguardando_informacoes).toHaveLength(0);
    expect(bs.em_decisao.map((c) => c.id)).toEqual(["a"]);
  });

  it("remove exclui o card", () => {
    useBoard.getState().setCards([card("a", "em_decisao", 1), card("b", "em_decisao", 2)]);
    useBoard.getState().remove("a");
    expect(useBoard.getState().find("a")).toBeUndefined();
    expect(useBoard.getState().find("b")).toBeDefined();
  });

  it("applyMove troca status e ordem (movimento otimista)", () => {
    useBoard.getState().setCards([card("a", "aguardando_informacoes", 1)]);
    useBoard.getState().applyMove("a", "em_decisao", 99);
    const c = useBoard.getState().find("a")!;
    expect(c.status).toBe("em_decisao");
    expect(c.ordem).toBe(99);
  });

  it("applyMove em id inexistente não altera o estado", () => {
    useBoard.getState().setCards([card("a", "em_decisao", 1)]);
    const antes = useBoard.getState().byStatus;
    useBoard.getState().applyMove("zzz", "aguardando_informacoes", 5);
    expect(useBoard.getState().byStatus).toBe(antes);
  });

  it("setFiltro atualiza o termo", () => {
    useBoard.getState().setFiltro("rua");
    expect(useBoard.getState().filtro).toBe("rua");
  });
});
