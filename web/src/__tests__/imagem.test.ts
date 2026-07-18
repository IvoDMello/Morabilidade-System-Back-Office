import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rotacionarArquivoImagem } from "@/lib/imagem";

// rotacionarArquivoImagem depende de APIs de browser (Image, canvas, URL) que o
// jsdom não implementa de verdade. Mockamos o suficiente para exercitar o
// caminho de rotação sem depender de um motor de canvas real.

function fakeFile(nome = "foto.png"): File {
  return new File([new Uint8Array([1, 2, 3])], nome, { type: "image/png" });
}

describe("rotacionarArquivoImagem, validações (sem canvas)", () => {
  it("devolve o mesmo arquivo quando a rotação é 0", async () => {
    const f = fakeFile();
    expect(await rotacionarArquivoImagem(f, 0)).toBe(f);
  });

  it("trata múltiplos de 360 como 0 (no-op)", async () => {
    const f = fakeFile();
    expect(await rotacionarArquivoImagem(f, 360)).toBe(f);
    expect(await rotacionarArquivoImagem(f, 720)).toBe(f);
  });

  it("rejeita rotações que não sejam 90/180/270", async () => {
    await expect(rotacionarArquivoImagem(fakeFile(), 45)).rejects.toThrow(/inválida/i);
  });
});

describe("rotacionarArquivoImagem, caminho de rotação", () => {
  let drawImage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    drawImage = vi.fn();

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:fake"),
      revokeObjectURL: vi.fn(),
    });

    // Image que dispara onload assim que recebe um src.
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 200;
      naturalHeight = 100;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", FakeImage as unknown as typeof Image);

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      translate: vi.fn(),
      rotate: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D);

    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback
    ) {
      cb(new Blob(["x"], { type: "image/jpeg" }));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("gera um File JPEG mantendo o nome (extensão trocada para .jpg)", async () => {
    const out = await rotacionarArquivoImagem(fakeFile("minha-foto.png"), 90);
    expect(out).toBeInstanceOf(File);
    expect(out.type).toBe("image/jpeg");
    expect(out.name).toBe("minha-foto.jpg");
    expect(drawImage).toHaveBeenCalledOnce();
  });

  it("troca as dimensões do canvas em 90 graus", async () => {
    const createSpy = vi.spyOn(document, "createElement");
    await rotacionarArquivoImagem(fakeFile(), 90);
    const canvas = createSpy.mock.results.find(
      (r) => (r.value as HTMLElement).tagName === "CANVAS"
    )?.value as HTMLCanvasElement;
    // naturalHeight (100) vira largura; naturalWidth (200) vira altura.
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(200);
  });

  it("mantém as dimensões em 180 graus", async () => {
    const createSpy = vi.spyOn(document, "createElement");
    await rotacionarArquivoImagem(fakeFile(), 180);
    const canvas = createSpy.mock.results.find(
      (r) => (r.value as HTMLElement).tagName === "CANVAS"
    )?.value as HTMLCanvasElement;
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
  });
});
