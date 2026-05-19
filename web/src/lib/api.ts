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
  // Para FormData (uploads), removemos o Content-Type herdado da instância.
  // Sem isso, o axios v1 detecta `application/json` e chama `formDataToJSON()`,
  // descartando os arquivos — o servidor recebe `{}` e responde 422.
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    if (config.headers) {
      delete (config.headers as Record<string, unknown>)["Content-Type"];
      delete (config.headers as Record<string, unknown>)["content-type"];
    }
  }
  return config;
});

// Extrai uma mensagem legível de qualquer erro da API. Cobre:
//  - HTTPException(detail="texto") → string
//  - Pydantic validation (422)     → array de {loc, msg, type, input}
//  - Qualquer outro caso           → fallback fornecido pelo chamador
// Retornar SEMPRE string evita o React error #31 ("Objects are not valid as a
// React child") quando o detail é passado direto pro toast.
// Nota: axiosErr.message ("Network Error", "Request failed with status code 422")
// não é amigável; o fallback do chamador é melhor para o usuário final.
export function getErrorMessage(err: unknown, fallback = "Ocorreu um erro."): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((e) => {
        if (typeof e === "string") return e;
        const obj = e as { msg?: string; loc?: unknown[] };
        const msg = obj?.msg ?? "Erro de validação";
        const loc = Array.isArray(obj?.loc) ? obj.loc.filter((p) => p !== "body").join(".") : "";
        return loc ? `${msg} (${loc})` : msg;
      })
      .join("; ");
  }

  return fallback;
}

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
