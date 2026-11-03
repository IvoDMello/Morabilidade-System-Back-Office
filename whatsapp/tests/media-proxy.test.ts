import { beforeEach, describe, expect, it, vi } from "vitest";
import { mediaResponseHeaders } from "@/lib/whatsapp-media";

const getMediaObject = vi.fn();
vi.mock("@/services/data", () => ({
  dataSource: { whatsapp: { getMediaObject: (path: string) => getMediaObject(path) } },
}));

const { GET } = await import("@/app/api/whatsapp/media/route");

/**
 * Proxy de mídia: o mime-type vem do remetente, então HTML/SVG mandados como
 * documento não podem abrir no domínio do atendimento.
 */
describe("mediaResponseHeaders", () => {
  it.each([
    ["image/jpeg", "image/jpeg"],
    ["image/png", "image/png"],
    ["audio/ogg; codecs=opus", "audio/ogg"],
    ["video/mp4", "video/mp4"],
    ["application/pdf", "application/pdf"],
  ])("%s abre no navegador", (armazenado, esperado) => {
    const headers = mediaResponseHeaders("5521/abc.bin", armazenado);
    expect(headers["Content-Type"]).toBe(esperado);
    expect(headers["Content-Disposition"]).toBeUndefined();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it.each(["text/html", "image/svg+xml", "application/xhtml+xml", "text/javascript", "application/zip"])(
    "%s vai como download, nunca com o tipo declarado",
    (armazenado) => {
      const headers = mediaResponseHeaders("5521/wamid.x/arquivo.html", armazenado);
      expect(headers["Content-Type"]).toBe("application/octet-stream");
      expect(headers["Content-Disposition"]).toBe('attachment; filename="arquivo.html"');
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    },
  );

  it("sem mime armazenado, usa a extensão do caminho", () => {
    expect(mediaResponseHeaders("5521/foto.jpg", "application/octet-stream")["Content-Type"]).toBe("image/jpeg");
    expect(mediaResponseHeaders("5521/foto.jpg", null)["Content-Type"]).toBe("image/jpeg");
    expect(mediaResponseHeaders("5521/pagina.html", null)["Content-Type"]).toBe("application/octet-stream");
  });

  it("limpa o nome do arquivo no Content-Disposition", () => {
    const headers = mediaResponseHeaders('5521/a"b;c\r\nd.html', "text/html");
    expect(headers["Content-Disposition"]).toBe('attachment; filename="a_b_c_d.html"');
  });
});

describe("GET /api/whatsapp/media", () => {
  beforeEach(() => getMediaObject.mockReset());

  function pedir(path: string) {
    return GET(new Request(`https://atendimento.test/api/whatsapp/media?path=${encodeURIComponent(path)}`));
  }

  it("recusa caminho que tenta sair do bucket", async () => {
    expect((await pedir("../segredo")).status).toBe(400);
    expect((await pedir("/raiz/arquivo")).status).toBe(400);
    expect(getMediaObject).not.toHaveBeenCalled();
  });

  it("404 quando o objeto não existe", async () => {
    getMediaObject.mockResolvedValue(null);
    expect((await pedir("5521/sumiu.jpg")).status).toBe(404);
  });

  it("documento HTML recebido sai como download", async () => {
    getMediaObject.mockResolvedValue({ data: new Blob(["<script>alert(1)</script>"]), mimeType: "text/html" });
    const res = await pedir("5521/wamid.x/convite.html");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="convite.html"');
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("foto continua abrindo inline", async () => {
    getMediaObject.mockResolvedValue({ data: new Blob(["jpeg"]), mimeType: "image/jpeg" });
    const res = await pedir("5521/wamid.y/foto.jpg");
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(await res.text()).toBe("jpeg");
  });
});
