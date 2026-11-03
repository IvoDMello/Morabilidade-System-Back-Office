import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { passos, supabaseFalso } from "@/test/supabase-falso";
import type { Captacao } from "@/types";
import { confirmarDecisao, decidirCaptacao, destinoDecisao, ordemFimDaColuna } from "./decisao";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const captacao = (campos: Partial<Captacao> = {}) =>
  ({ id: "c1", decisao: null, imovel_codigo: null, ...campos }) as Captacao;

describe("destinoDecisao", () => {
  it("aprovada vai agendar visita; reprovada vai para a negativa", () => {
    expect(destinoDecisao("aprovada")).toBe("pendente_agendar_visita");
    expect(destinoDecisao("reprovada")).toBe("pendente_negativa");
  });
});

describe("confirmarDecisao", () => {
  const confirm = vi.fn();
  beforeEach(() => {
    confirm.mockReset();
    vi.stubGlobal("window", { confirm });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reprovar captação que já virou imóvel pede confirmação citando o código", () => {
    confirm.mockReturnValue(false);
    expect(confirmarDecisao(captacao({ decisao: "aprovada", imovel_codigo: "MB-00042" }), "reprovada")).toBe(false);
    expect(confirm.mock.calls[0][0]).toContain("imóvel MB-00042");
  });

  it("nos outros casos segue sem perguntar", () => {
    expect(confirmarDecisao(captacao({ decisao: "aprovada" }), "reprovada")).toBe(true);
    expect(confirmarDecisao(captacao({ decisao: "aprovada", imovel_codigo: "MB-1" }), "aprovada")).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe("ordemFimDaColuna e decidirCaptacao", () => {
  beforeEach(() => vi.stubGlobal("window", { confirm: () => true }));
  afterEach(() => vi.unstubAllGlobals());

  it("ordem fica depois do maior `ordem` da coluna, ignorando excluídas", async () => {
    const db = supabaseFalso({ captacao: { data: [{ ordem: 10 }] } });
    vi.mocked(createClient).mockReturnValue(db as never);
    const ordem = await ordemFimDaColuna("novas");
    expect(ordem).toBeGreaterThan(10);
    expect(passos(db.chamadas[0])).toMatchObject({ eq: ["status", "novas"], is: ["excluido_em", null] });
  });

  it("coluna vazia também devolve uma ordem válida", async () => {
    vi.mocked(createClient).mockReturnValue(supabaseFalso({ captacao: { data: [] } }) as never);
    expect(Number.isFinite(await ordemFimDaColuna("novas"))).toBe(true);
  });

  it("decide pela RPC atômica mover_cartao no fim da coluna destino", async () => {
    const db = supabaseFalso({ captacao: { data: [{ ordem: 5 }] } });
    vi.mocked(createClient).mockReturnValue(db as never);
    expect(await decidirCaptacao(captacao(), "aprovada")).toBe("ok");
    const rpc = db.chamadas.find((c) => c.alvo === "rpc:mover_cartao")!;
    expect(rpc.passos[0][1][0]).toMatchObject({
      p_captacao_id: "c1",
      p_para_status: "pendente_agendar_visita",
      p_decisao: "aprovada",
    });
  });

  it("erro da RPC vira 'erro'; confirmação negada vira 'cancelado' sem tocar no banco", async () => {
    const db = supabaseFalso({ "rpc:mover_cartao": { error: { message: "x" } } });
    vi.mocked(createClient).mockReturnValue(db as never);
    expect(await decidirCaptacao(captacao(), "reprovada")).toBe("erro");

    vi.stubGlobal("window", { confirm: () => false });
    const intocado = supabaseFalso();
    vi.mocked(createClient).mockReturnValue(intocado as never);
    expect(await decidirCaptacao(captacao({ decisao: "aprovada", imovel_codigo: "MB-1" }), "reprovada")).toBe(
      "cancelado",
    );
    expect(intocado.chamadas).toHaveLength(0);
  });
});
