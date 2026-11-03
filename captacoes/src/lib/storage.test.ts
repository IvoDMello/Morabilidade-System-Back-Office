import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { supabaseFalso } from "@/test/supabase-falso";
import { BUCKET, signedUrl, uploadDocumento, uploadFoto, uploadVideo, VIDEO_MAX_MB } from "./storage";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/image", () => ({
  processImage: vi.fn(async () => ({ full: new File(["g"], "a.webp"), thumb: new File(["t"], "a-thumb.webp") })),
}));

function arquivo(nome: string, tipo: string, tamanho = 3) {
  const f = new File(["x".repeat(tamanho)], nome, { type: tipo });
  return f;
}

beforeEach(() => {
  let n = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => `uuid-${++n}` as `${string}-${string}-${string}-${string}-${string}`);
});

describe("uploadFoto", () => {
  it("sobe a grande e o thumb em WebP, em pastas separadas da captação", async () => {
    const db = supabaseFalso();
    vi.mocked(createClient).mockReturnValue(db as never);
    expect(await uploadFoto("cap-1", arquivo("a.jpg", "image/jpeg"))).toEqual({
      storage_path: "cap-1/fotos/uuid-1.webp",
      thumb_path: "cap-1/thumbs/uuid-2.webp",
    });
    expect(db.chamadas.map((c) => c.alvo)).toEqual([`storage:${BUCKET}`, `storage:${BUCKET}`]);
    expect(db.chamadas[0].passos[0][1][2]).toEqual({ contentType: "image/webp" });
  });

  it("propaga o erro do Storage", async () => {
    vi.mocked(createClient).mockReturnValue(supabaseFalso({ "storage:upload": { error: new Error("cota") } }) as never);
    await expect(uploadFoto("cap-1", arquivo("a.jpg", "image/jpeg"))).rejects.toThrow("cota");
  });
});

describe("uploadVideo", () => {
  it("recusa acima do limite antes de subir", async () => {
    const db = supabaseFalso();
    vi.mocked(createClient).mockReturnValue(db as never);
    const grande = arquivo("v.mp4", "video/mp4");
    Object.defineProperty(grande, "size", { value: VIDEO_MAX_MB * 1024 * 1024 + 1 });
    await expect(uploadVideo("cap-1", grande)).rejects.toThrow(`Vídeo acima de ${VIDEO_MAX_MB} MB`);
    expect(db.chamadas).toHaveLength(0);
  });

  it("usa a extensão do arquivo e cai em video/mp4 sem tipo", async () => {
    const db = supabaseFalso();
    vi.mocked(createClient).mockReturnValue(db as never);
    expect(await uploadVideo("cap-1", arquivo("Tour.MOV", ""))).toEqual({ storage_path: "cap-1/videos/uuid-1.mov" });
    expect(db.chamadas[0].passos[0][1][2]).toEqual({ contentType: "video/mp4" });
  });

  it("propaga o erro do Storage", async () => {
    vi.mocked(createClient).mockReturnValue(supabaseFalso({ "storage:upload": { error: new Error("x") } }) as never);
    await expect(uploadVideo("cap-1", arquivo("v.mp4", "video/mp4"))).rejects.toThrow("x");
  });
});

describe("uploadDocumento", () => {
  it("devolve os metadados para registrar em captacoes.midia", async () => {
    vi.mocked(createClient).mockReturnValue(supabaseFalso() as never);
    expect(await uploadDocumento("cap-1", arquivo("IPTU.pdf", "application/pdf", 10))).toEqual({
      storage_path: "cap-1/docs/uuid-1.pdf",
      nome_original: "IPTU.pdf",
      mime_type: "application/pdf",
      tamanho_bytes: 10,
    });
  });

  it("sem tipo grava octet-stream e mime nulo; erro propaga", async () => {
    const db = supabaseFalso();
    vi.mocked(createClient).mockReturnValue(db as never);
    expect((await uploadDocumento("cap-1", arquivo("leia", ""))).mime_type).toBeNull();
    expect(db.chamadas[0].passos[0][1][2]).toEqual({ contentType: "application/octet-stream" });

    vi.mocked(createClient).mockReturnValue(supabaseFalso({ "storage:upload": { error: new Error("y") } }) as never);
    await expect(uploadDocumento("cap-1", arquivo("a.pdf", "application/pdf"))).rejects.toThrow("y");
  });
});

describe("signedUrl", () => {
  it("assina por 5 minutos por padrão", async () => {
    const db = supabaseFalso({ "storage:createSignedUrl": { data: { signedUrl: "https://s/assinada" } } });
    vi.mocked(createClient).mockReturnValue(db as never);
    expect(await signedUrl("cap-1/fotos/a.webp")).toBe("https://s/assinada");
    expect(db.chamadas[0].passos[0][1]).toEqual(["cap-1/fotos/a.webp", 300]);
  });

  it("propaga o erro", async () => {
    vi.mocked(createClient).mockReturnValue(supabaseFalso({ "storage:createSignedUrl": { error: new Error("z") } }) as never);
    await expect(signedUrl("p", 60)).rejects.toThrow("z");
  });
});
