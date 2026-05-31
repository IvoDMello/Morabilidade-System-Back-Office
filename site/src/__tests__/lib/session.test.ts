import { describe, it, expect, beforeEach, vi } from "vitest";
import { getOrCreateSessionId, sendBeaconJSON } from "@/lib/session";

describe("getOrCreateSessionId", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("retorna o mesmo id em chamadas consecutivas dentro da mesma sessão", () => {
    const a = getOrCreateSessionId();
    const b = getOrCreateSessionId();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(8);
  });

  it("persiste o id em sessionStorage", () => {
    const id = getOrCreateSessionId();
    expect(window.sessionStorage.getItem("mora_session_id")).toBe(id);
  });

  it("gera id efêmero quando sessionStorage joga (modo anônimo restrito)", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage bloqueado");
    });
    const id = getOrCreateSessionId();
    expect(id.startsWith("eph-")).toBe(true);
    spy.mockRestore();
  });
});

describe("sendBeaconJSON", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("usa navigator.sendBeacon quando disponível", () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon });
    sendBeaconJSON("/publico/foo", { a: 1 });
    expect(sendBeacon).toHaveBeenCalledOnce();
    const [url, blob] = sendBeacon.mock.calls[0];
    expect(url).toContain("/publico/foo");
    expect(blob).toBeInstanceOf(Blob);
  });

  it("faz fallback pra fetch keepalive quando sendBeacon falha", () => {
    const sendBeacon = vi.fn(() => false);
    const fetchMock = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("fetch", fetchMock);
    sendBeaconJSON("/publico/foo", { a: 1 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/publico/foo");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).keepalive).toBe(true);
  });

  it("nunca lança — engole erros para não quebrar a navegação", () => {
    vi.stubGlobal("navigator", {
      sendBeacon: () => { throw new Error("denied"); },
    });
    expect(() => sendBeaconJSON("/x", { a: 1 })).not.toThrow();
  });
});
