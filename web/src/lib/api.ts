import axios from "axios";
import { useAuthStore } from "./auth-store";

export const api = axios.create({
  baseURL: "/api/proxy",
  headers: { "Content-Type": "application/json" },
});

// Inclui o token JWT como Authorization header em todas as requisições
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redireciona para login e limpa sessão em caso de 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      useAuthStore.getState().clearAuth();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
