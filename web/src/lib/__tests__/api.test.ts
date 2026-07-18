import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";

type AuthStateMock = ReturnType<typeof makeAuthState>;

function makeAuthState(overrides: { token?: string | null; clearAuth?: () => void } = {}) {
  return {
    user: null,
    token: overrides.token ?? null,
    setUser: vi.fn(),
    setToken: vi.fn(),
    clearAuth: overrides.clearAuth ?? vi.fn(),
    logout: vi.fn(),
  };
}

vi.mock("../auth-store", () => ({
  useAuthStore: {
    getState: vi.fn<() => AuthStateMock>(() => makeAuthState()),
  },
}));

import { useAuthStore } from "../auth-store";
import { api } from "../api";

const requestHandler = api.interceptors.request.handlers![0];
const responseHandler = api.interceptors.response.handlers![0];

describe("api, interceptor de request", () => {
  it("não adiciona Authorization quando token é nulo", async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue(makeAuthState({ token: null }));

    const config = await requestHandler.fulfilled!({
      headers: axios.defaults.headers as never,
      url: "/test",
    } as never);

    expect((config.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });

  it("adiciona Authorization quando token está presente", async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue(makeAuthState({ token: "jwt-xyz" }));

    const config = await requestHandler.fulfilled!({
      headers: axios.defaults.headers as never,
      url: "/test",
    } as never);

    expect((config.headers as Record<string, string>)["Authorization"]).toBe("Bearer jwt-xyz");
  });
});

describe("api, interceptor de response (401)", () => {
  const originalLocation = window.location;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "/", pathname: "/", search: "" },
    });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ignora 401 sem config (ex: cancel), não tenta refresh nem logout", async () => {
    const clearAuth = vi.fn();
    vi.mocked(useAuthStore.getState).mockReturnValue(makeAuthState({ token: "tok", clearAuth }));

    const handler = responseHandler.rejected!;
    const error = { response: { status: 401 } };

    await expect(handler(error)).rejects.toEqual(error);
    expect(clearAuth).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("em 401: tenta refresh; se falhar, faz logout e redireciona", async () => {
    const clearAuth = vi.fn();
    vi.mocked(useAuthStore.getState).mockReturnValue(makeAuthState({ token: "tok", clearAuth }));

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const handler = responseHandler.rejected!;
    const error = {
      response: { status: 401 },
      config: { url: "/imoveis/" },
    };

    await expect(handler(error)).rejects.toEqual(error);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/refresh",
      expect.objectContaining({ method: "POST" }),
    );
    expect(clearAuth).toHaveBeenCalled();
    expect(window.location.href).toContain("/login");
  });

  it("em 401 da rota /auth/*: força logout sem tentar refresh em loop", async () => {
    const clearAuth = vi.fn();
    vi.mocked(useAuthStore.getState).mockReturnValue(makeAuthState({ token: "tok", clearAuth }));
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const handler = responseHandler.rejected!;
    const error = {
      response: { status: 401 },
      config: { url: "/auth/logout" },
    };

    await expect(handler(error)).rejects.toEqual(error);

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/auth/refresh",
      expect.anything(),
    );
    expect(clearAuth).toHaveBeenCalled();
  });

  it("não redireciona para outros status de erro", async () => {
    const clearAuth = vi.fn();
    vi.mocked(useAuthStore.getState).mockReturnValue(makeAuthState({ token: "tok", clearAuth }));

    const handler = responseHandler.rejected!;
    const error = {
      response: { status: 404 },
      config: { url: "/imoveis/" },
    };

    await expect(handler(error)).rejects.toEqual(error);
    expect(clearAuth).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.location.href).toBe("/");
  });
});
