import { describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { supabaseFalso } from "@/test/supabase-falso";
import { corAvatar, fetchOpinioesResumo, iniciaisNome } from "./opinioes";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

describe("fetchOpinioesResumo", () => {
  it("indexa os contadores por captação, convertendo bigint em número", async () => {
    vi.mocked(createClient).mockReturnValue(
      supabaseFalso({
        "rpc:opinioes_resumo": {
          data: [
            { captacao_id: "c1", total: "3", nao_lidas: "1" },
            { captacao_id: "c2", total: 1, nao_lidas: 0 },
          ],
        },
      }) as never,
    );
    expect(await fetchOpinioesResumo()).toEqual({
      c1: { total: 3, naoLidas: 1 },
      c2: { total: 1, naoLidas: 0 },
    });
  });

  it("erro ou resposta vazia devolve objeto vazio, sem quebrar o quadro", async () => {
    vi.mocked(createClient).mockReturnValue(supabaseFalso({ "rpc:opinioes_resumo": { error: { message: "x" } } }) as never);
    expect(await fetchOpinioesResumo()).toEqual({});
    vi.mocked(createClient).mockReturnValue(supabaseFalso() as never);
    expect(await fetchOpinioesResumo()).toEqual({});
  });
});

describe("iniciaisNome", () => {
  it.each([
    ["Ana Paula Souza", "AS"],
    ["  maria   ", "MA"],
    ["Ivo", "IV"],
    ["", "?"],
    ["   ", "?"],
  ])("%j → %s", (nome, esperado) => {
    expect(iniciaisNome(nome)).toBe(esperado);
  });
});

describe("corAvatar", () => {
  it("é estável para a mesma pessoa e sai da paleta do app", () => {
    expect(corAvatar("Ana")).toEqual(corAvatar("Ana"));
    expect(corAvatar("Ana")).toHaveProperty("bg");
    const cores = new Set(["Ana", "Bruno", "Carla", "Duda", "Edu", "Fê", "Gil"].map((n) => corAvatar(n).bg));
    expect(cores.size).toBeGreaterThan(1);
  });
});
