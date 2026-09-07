import { describe, it, expect } from "vitest";
import { contarMidia, rotuloMidia, MIDIA_VAZIA } from "./midia";

const m = (captacao_id: string, tipo: "foto" | "video") => ({ captacao_id, tipo });

describe("contarMidia", () => {
  it("separa fotos de vídeos por captação", () => {
    const r = contarMidia([m("a", "foto"), m("a", "foto"), m("a", "video"), m("b", "foto")]);
    expect(r.a).toEqual({ fotos: 2, videos: 1 });
    expect(r.b).toEqual({ fotos: 1, videos: 0 });
  });

  it("captação sem mídia simplesmente não aparece", () => {
    expect(contarMidia([])).toEqual({});
    expect(contarMidia([m("a", "foto")]).b).toBeUndefined();
  });
});

describe("rotuloMidia", () => {
  it("singular e plural", () => {
    expect(rotuloMidia({ fotos: 1, videos: 0 })).toBe("1 foto");
    expect(rotuloMidia({ fotos: 8, videos: 0 })).toBe("8 fotos");
    expect(rotuloMidia({ fotos: 0, videos: 1 })).toBe("1 vídeo");
    expect(rotuloMidia({ fotos: 0, videos: 3 })).toBe("3 vídeos");
  });

  it("junta os dois quando existem", () => {
    expect(rotuloMidia({ fotos: 8, videos: 1 })).toBe("8 fotos · 1 vídeo");
  });

  it("sem mídia não vira selo vazio", () => {
    expect(rotuloMidia(MIDIA_VAZIA)).toBeNull();
  });
});
