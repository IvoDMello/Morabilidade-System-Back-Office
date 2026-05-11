import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";

// Mock do módulo de auth antes de importar api
vi.mock("../auth-store", () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      token: null,
      clearAuth: vi.fn(),
    })),
  },
}));

import { useAuthStore } from "../auth-store";
import { api } from "../api";

describe("api — interceptor de request", () => {
  it("não adiciona Authorization quando token é nulo", async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue({
      token: null,
      clearAuth: vi.fn(),
    });

    const config = await api.interceptors.request.handlers[0].fulfilled!({
      headers: axios.defaults.headers as never,
      url: "/test",
    } as never);

    expect((config.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });

  it("adiciona Authorization quando token está presente", async () => {
    vi.mocked(useAuthStore.getState).mockReturnValue({
      token: "jwt-xyz",
      clearAuth: vi.fn(),
    });

    const config = await api.interceptors.request.handlers[0].fulfilled!({
      headers: axios.defaults.headers as never,
      url: "/test",
    } as never);

    expect((config.headers as Record<string, string>)["Authorization"]).toBe("Bearer jwt-xyz");
  });
});

describe("api — interceptor de response (401)", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "/" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({}));
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
    vi.unstubAllGlobals();
  });

  it("chama clearAuth e redireciona para /login em 401", async () => {
    const clearAuth = vi.fn();
    vi.mocked(useAuthStore.getState).mockReturnValue({ token: "tok", clearAuth });

    const handler = api.interceptors.response.handlers[0].rejected!;
    const error = { response: { status: 401 } };

    await expect(handler(error)).rejects.toEqual(error);

    expect(clearAuth).toHaveBeenCalled();
    expect(window.location.href).toBe("/login");
  });

  it("não redireciona para outros status de erro", async () => {
    const clearAuth = vi.fn();
    vi.mocked(useAuthStore.getState).mockReturnValue({ token: "tok", clearAuth });

    const handler = api.interceptors.response.handlers[0].rejected!;
    const error = { response: { status: 404 } };

    await expect(handler(error)).rejects.toEqual(error);
    expect(clearAuth).not.toHaveBeenCalled();
    expect(window.location.href).toBe("/");
  });
});
