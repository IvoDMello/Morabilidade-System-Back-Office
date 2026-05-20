import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { useAuthStore } from "./auth-store";

export const api = axios.create({
  baseURL: "/api/proxy",
  headers: { "Content-Type": "application/json" },
});

// Inclui o token JWT como Authorization header em todas as requisições.
// Em produção o token vive em cookie httpOnly (não acessível ao JS); nesse caso
// o store retorna null e o proxy [...path] lê o token direto do cookie.
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

// ── Refresh-on-401 com mutex ─────────────────────────────────────────────────
//
// Cenário: token expira no meio do uso. Várias requests podem voltar 401 ao
// mesmo tempo (ex: dashboard carregando 4 endpoints em paralelo). Sem mutex,
// dispararíamos 4 refreshes — o Supabase rotaciona o refresh_token a cada uso,
// só o primeiro daria certo e os 3 restantes invalidariam o token recém-emitido.
//
// `refreshPromise` mantém UMA chamada em voo; chamadas concorrentes aguardam o
// mesmo resultado.

let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      // Notifica listeners (AuthProvider) com o novo expires_in.
      try {
        const data = (await res.json()) as { expires_in?: number };
        if (typeof window !== "undefined" && typeof data.expires_in === "number") {
          window.dispatchEvent(
            new CustomEvent("auth:refreshed", { detail: { expires_in: data.expires_in } }),
          );
        }
      } catch {}
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function forceLogout() {
  if (typeof window === "undefined") return;
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  useAuthStore.getState().clearAuth();
  // Preserva a rota atual para voltar após o login.
  const next = window.location.pathname + window.location.search;
  const loginUrl = next && next !== "/login"
    ? `/login?next=${encodeURIComponent(next)}`
    : "/login";
  window.location.href = loginUrl;
}

// Marcador para evitar loop infinito: se uma request já foi reenviada após
// refresh e ainda assim voltou 401, é porque o refresh não bastou — logout.
type RetriableConfig = AxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as RetriableConfig | undefined;

    if (status !== 401 || !original || typeof window === "undefined") {
      return Promise.reject(error);
    }

    // Endpoint de refresh dando 401 não pode tentar refresh de novo.
    if (typeof original.url === "string" && original.url.includes("/auth/")) {
      await forceLogout();
      return Promise.reject(error);
    }

    if (original._retry) {
      await forceLogout();
      return Promise.reject(error);
    }
    original._retry = true;

    const refreshed = await refreshTokens();
    if (!refreshed) {
      await forceLogout();
      return Promise.reject(error);
    }

    return api(original);
  },
);

export { refreshTokens };
