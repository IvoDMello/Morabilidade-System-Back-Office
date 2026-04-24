import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "react";
import { useAuthStore } from "@/lib/auth-store";

const MOCK_USER = {
  id: "user-uuid-1",
  nome_completo: "Admin Teste",
  email: "admin@teste.com",
  perfil: "admin" as const,
  foto_url: undefined,
  telefone: undefined,
  ativo: true,
};

beforeEach(() => {
  act(() => {
    useAuthStore.getState().clearAuth();
  });
});

describe("useAuthStore — estado inicial", () => {
  it("começa sem usuário logado", () => {
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe("useAuthStore — setUser", () => {
  it("armazena o usuário corretamente", () => {
    act(() => {
      useAuthStore.getState().setUser(MOCK_USER);
    });
    expect(useAuthStore.getState().user).toEqual(MOCK_USER);
  });

  it("sobrescreve usuário anterior", () => {
    const outro = { ...MOCK_USER, email: "outro@teste.com" };
    act(() => {
      useAuthStore.getState().setUser(MOCK_USER);
      useAuthStore.getState().setUser(outro);
    });
    expect(useAuthStore.getState().user?.email).toBe("outro@teste.com");
  });
});

describe("useAuthStore — clearAuth", () => {
  it("remove o usuário do estado", () => {
    act(() => {
      useAuthStore.getState().setUser(MOCK_USER);
      useAuthStore.getState().clearAuth();
    });
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe("useAuthStore — logout", () => {
  it("limpa o estado do usuário", () => {
    act(() => {
      useAuthStore.getState().setUser(MOCK_USER);
      useAuthStore.getState().logout();
    });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("chama /api/auth/logout via fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      useAuthStore.getState().setUser(MOCK_USER);
      useAuthStore.getState().logout();
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({ method: "POST" })
      );
    });

    vi.unstubAllGlobals();
  });

  it("não lança erro se o fetch falhar", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(() => {
      act(() => {
        useAuthStore.getState().setUser(MOCK_USER);
        useAuthStore.getState().logout();
      });
    }).not.toThrow();
    vi.unstubAllGlobals();
  });
});
