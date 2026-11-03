import { afterEach, describe, expect, it, vi } from "vitest";
import { cronAutorizado } from "./cron-auth";

function pedido(authorization?: string) {
  return new Request("https://captacoes.test/api/cron/arquivar", {
    headers: authorization ? { authorization } : {},
  });
}

describe("cronAutorizado", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("aceita o Bearer com o segredo configurado", () => {
    vi.stubEnv("CRON_SECRET", "s3gr3do");
    expect(cronAutorizado(pedido("Bearer s3gr3do"))).toBe(true);
  });

  it("recusa segredo errado, ausente ou sem o prefixo", () => {
    vi.stubEnv("CRON_SECRET", "s3gr3do");
    expect(cronAutorizado(pedido("Bearer outro"))).toBe(false);
    expect(cronAutorizado(pedido("Bearer s3gr3do-mais"))).toBe(false);
    expect(cronAutorizado(pedido("s3gr3do"))).toBe(false);
    expect(cronAutorizado(pedido())).toBe(false);
  });

  it("sem CRON_SECRET recusa tudo, inclusive 'Bearer undefined'", () => {
    vi.stubEnv("CRON_SECRET", undefined);
    expect(cronAutorizado(pedido("Bearer undefined"))).toBe(false);
    expect(cronAutorizado(pedido("Bearer "))).toBe(false);
  });
});
