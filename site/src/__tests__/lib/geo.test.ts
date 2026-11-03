import { afterEach, describe, expect, it, vi } from "vitest";
import { capturarGeo } from "@/lib/geo";
import { geocodificarEndereco } from "@/lib/geocoding";

/**
 * capturarGeo nunca bloqueia a assinatura: sem suporte, sem permissão ou sem
 * resposta, resolve null. geocodificarEndereco idem para o mapa do imóvel.
 */

function stubGeolocation(getCurrentPosition: Geolocation["getCurrentPosition"] | undefined) {
  vi.stubGlobal("navigator", getCurrentPosition ? { geolocation: { getCurrentPosition } } : {});
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("capturarGeo", () => {
  it("formata latitude, longitude e precisão", async () => {
    stubGeolocation((ok) =>
      ok({ coords: { latitude: -22.98321234, longitude: -43.2071, accuracy: 17.6 } } as GeolocationPosition),
    );
    expect(await capturarGeo()).toBe("-22.983212, -43.207100 (±18m)");
  });

  it("sem precisão informada omite o ±", async () => {
    stubGeolocation((ok) => ok({ coords: { latitude: 1, longitude: 2, accuracy: NaN } } as GeolocationPosition));
    expect(await capturarGeo()).toBe("1.000000, 2.000000");
  });

  it("sem suporte ou com permissão negada resolve null", async () => {
    stubGeolocation(undefined);
    expect(await capturarGeo()).toBeNull();
    stubGeolocation((_, erro) => erro?.({ code: 1 } as GeolocationPositionError));
    expect(await capturarGeo()).toBeNull();
  });

  it("navegador que nunca responde não segura a assinatura", async () => {
    vi.useFakeTimers();
    stubGeolocation(() => {});
    const promessa = capturarGeo(1000);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await promessa).toBeNull();
  });
});

describe("geocodificarEndereco", () => {
  const mockFetch = vi.fn();

  it("busca no Nominatim com o endereço completo e devolve as coordenadas", async () => {
    vi.stubGlobal("fetch", mockFetch.mockResolvedValue({ ok: true, json: async () => [{ lat: "-22.98", lon: "-43.2" }] }));
    expect(await geocodificarEndereco("Rua Bom Pastor, 521", "Tijuca", "Rio de Janeiro")).toEqual({ lat: -22.98, lng: -43.2 });
    const [url, init] = mockFetch.mock.calls[0];
    expect(decodeURIComponent(url)).toContain("q=Rua Bom Pastor, 521, Tijuca, Rio de Janeiro, Brasil");
    expect(init.headers["User-Agent"]).toContain("Morabilidade");
  });

  it.each([
    ["HTTP de erro", { ok: false, json: async () => [] }],
    ["sem resultado", { ok: true, json: async () => [] }],
    ["coordenada inválida", { ok: true, json: async () => [{ lat: "x", lon: "y" }] }],
  ])("%s devolve null", async (_, res) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
    expect(await geocodificarEndereco(undefined, "Leblon", "Rio de Janeiro")).toBeNull();
  });

  it("timeout ou rede fora devolve null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));
    expect(await geocodificarEndereco(undefined, "Leblon", "Rio de Janeiro")).toBeNull();
  });
});
