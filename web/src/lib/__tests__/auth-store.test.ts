import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../auth-store";

const USER = {
  id: "u1",
  nome_completo: "Ana Lima",
  email: "ana@morabilidade.com",
  perfil: "admin" as const,
};

beforeEach(() => {
  useAuthStore.getState().clearAuth();
});

describe("useAuthStore", () => {
  it("inicia sem usuário e sem token", () => {
    const { user, token } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(token).toBeNull();
  });

  it("setUser armazena o usuário", () => {
    useAuthStore.getState().setUser(USER);
    expect(useAuthStore.getState().user).toMatchObject({ email: "ana@morabilidade.com" });
  });

  it("setToken armazena o token", () => {
    useAuthStore.getState().setToken("jwt-abc-123");
    expect(useAuthStore.getState().token).toBe("jwt-abc-123");
  });

  it("clearAuth limpa usuário e token", () => {
    useAuthStore.getState().setUser(USER);
    useAuthStore.getState().setToken("jwt-abc-123");

    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
  });
});
