import { describe, expect, it, vi } from "vitest";
import imageCompression from "browser-image-compression";
import { processImage } from "./image";

vi.mock("browser-image-compression", () => ({
  default: vi.fn(async (_file: File, opcoes: { maxWidthOrHeight: number }) => new Blob([`${opcoes.maxWidthOrHeight}`])),
}));

describe("processImage", () => {
  it("gera a versão grande e o thumb em WebP, com o nome original", async () => {
    const { full, thumb } = await processImage(new File(["x"], "sala.ampla.JPG", { type: "image/jpeg" }));

    expect(full.name).toBe("sala.ampla.webp");
    expect(thumb.name).toBe("sala.ampla-thumb.webp");
    expect(full.type).toBe("image/webp");
    expect(await full.text()).toBe("1600");
    expect(await thumb.text()).toBe("400");
    for (const [, opcoes] of vi.mocked(imageCompression).mock.calls) {
      expect(opcoes).toMatchObject({ useWebWorker: true, fileType: "image/webp" });
    }
  });
});
