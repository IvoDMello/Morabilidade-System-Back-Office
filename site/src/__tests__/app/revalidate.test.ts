import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/revalidate/route";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

/** Revalidação on-demand chamada pelo back-office ao salvar um imóvel. */

function pedido(segredo?: string, corpo?: unknown) {
  return new NextRequest("https://morabilidade.com/api/revalidate", {
    method: "POST",
    headers: segredo ? { "x-revalidate-secret": segredo } : {},
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/revalidate", () => {
  it("sem REVALIDATE_SECRET configurado recusa tudo (500), sem revalidar", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");
    const res = await POST(pedido("qualquer"));
    expect(res.status).toBe(500);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("segredo errado ou ausente responde 401", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "s3gr3do");
    expect((await POST(pedido("outro"))).status).toBe(401);
    expect((await POST(pedido())).status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("com código revalida a página do imóvel, a listagem, a home e os bairros", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "s3gr3do");
    const res = await POST(pedido("s3gr3do", { codigo: "MB-00043" }));
    expect(await res.json()).toEqual({ revalidated: true, paths: ["/", "/imoveis", "/imoveis/MB-00043"] });
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual(["/", "/imoveis", "/imoveis/MB-00043"]);
    expect(revalidateTag).toHaveBeenCalledWith("bairros");
  });

  it("corpo vazio ou inválido revalida só listagem e home", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "s3gr3do");
    expect((await (await POST(pedido("s3gr3do"))).json()).paths).toEqual(["/", "/imoveis"]);
    expect((await (await POST(pedido("s3gr3do", { codigo: 42 }))).json()).paths).toEqual(["/", "/imoveis"]);
  });
});
