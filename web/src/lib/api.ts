import axios from "axios";

export const api = axios.create({
  baseURL: "/api/proxy",
  headers: { "Content-Type": "application/json" },
});

// Redireciona para login e limpa sessão em caso de 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      const { useAuthStore } = await import("./auth-store");
      useAuthStore.getState().clearAuth();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
