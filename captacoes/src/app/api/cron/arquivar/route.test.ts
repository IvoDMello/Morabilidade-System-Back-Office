import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

/** Cadeia do supabase-js: cada filtro devolve o mesmo objeto; `select` encerra. */
function clienteFalso(resultado: { data: { id: string }[] | null; error: { message: string } | null }) {
  const cadeia = {
    from: vi.fn(() => cadeia),
    update: vi.fn(() => cadeia),
    in: vi.fn(() => cadeia),
    lt: vi.fn(() => cadeia),
    is: vi.fn(() => cadeia),
    select: vi.fn(async () => resultado),
  };
  return cadeia;
}

function pedido(authorization?: string) {
  return new Request("https://captacoes.test/api/cron/arquivar", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/cron/arquivar", () => {
  beforeEach(() => vi.mocked(createAdminClient).mockReset());
  afterEach(() => vi.unstubAllEnvs());

  it("sem CRON_SECRET configurado responde 401 e não toca no banco", async () => {
    vi.stubEnv("CRON_SECRET", undefined);
    const res = await GET(pedido("Bearer undefined"));
    expect(res.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("arquiva as captações decididas antes do prazo de retenção", async () => {
    vi.stubEnv("CRON_SECRET", "s3gr3do");
    vi.stubEnv("RETENCAO_MIDIA_DIAS", "30");
    const cliente = clienteFalso({ data: [{ id: "a" }, { id: "b" }], error: null });
    vi.mocked(createAdminClient).mockReturnValue(cliente as never);

    const antes = Date.now();
    const res = await GET(pedido("Bearer s3gr3do"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ arquivadas: 2 });
    expect(cliente.from).toHaveBeenCalledWith("captacao");
    expect(cliente.in).toHaveBeenCalledWith("status", ["negativada", "pendente_agendar_gravacao"]);
    const [, limite] = cliente.lt.mock.calls[0] as unknown as [string, string];
    const dias = (antes - Date.parse(limite)) / 86_400_000;
    expect(dias).toBeCloseTo(30, 1);
  });

  it("erro do banco vira 500 com a mensagem", async () => {
    vi.stubEnv("CRON_SECRET", "s3gr3do");
    vi.mocked(createAdminClient).mockReturnValue(
      clienteFalso({ data: null, error: { message: "timeout" } }) as never,
    );
    const res = await GET(pedido("Bearer s3gr3do"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "timeout" });
  });
});
