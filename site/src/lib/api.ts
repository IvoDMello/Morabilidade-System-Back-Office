import type { ImovelCard, Imovel, Tag, FiltrosParams } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Timeouts curtos pra que uma API lenta não trave o SSR da Vercel até o gateway
// cortar (~25s). Em incidentes anteriores o Railway ficou respondendo devagar
// e o site público demorou minutos por página.
const TIMEOUT_GET_MS = 8000;
const TIMEOUT_POST_MS = 15000;

export interface ListResponse<T> {
  data: T[];
  total: number;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {},
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Retry só em GET (idempotente) e só em 502/503/504/timeout. POST não retenta
// pra não duplicar contato/etc. Um único retry com backoff curto, suficiente
// pra cobrir restart do Railway sem segurar o SSR.
async function fetchGetWithRetry(
  input: string,
  init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {},
  timeoutMs: number = TIMEOUT_GET_MS,
): Promise<Response> {
  try {
    const res = await fetchWithTimeout(input, init, timeoutMs);
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      await new Promise((r) => setTimeout(r, 400));
      return await fetchWithTimeout(input, init, timeoutMs);
    }
    return res;
  } catch (err) {
    await new Promise((r) => setTimeout(r, 400));
    return await fetchWithTimeout(input, init, timeoutMs);
  }
}

export async function getImoveisDisponiveis(
  params: FiltrosParams = {}
): Promise<ListResponse<ImovelCard>> {
  const url = new URL(`${API_URL}/imoveis/publico/disponiveis`);
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || v === "") return;
    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (item) url.searchParams.append(k, String(item));
      });
    } else {
      url.searchParams.set(k, String(v));
    }
  });

  const res = await fetchGetWithRetry(
    url.toString(),
    { next: { revalidate: 60 } },
  );
  if (!res.ok) throw new Error("Erro ao buscar imóveis");

  const data: ImovelCard[] = await res.json();
  const total = Number(res.headers.get("x-total-count") ?? data.length);
  return { data, total };
}

export async function getImoveisDestaques(): Promise<ImovelCard[]> {
  const res = await fetchGetWithRetry(
    `${API_URL}/imoveis/publico/destaques`,
    { next: { revalidate: 60 } },
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getImovel(codigo: string): Promise<Imovel | null> {
  const res = await fetchGetWithRetry(
    `${API_URL}/imoveis/publico/${codigo}`,
    // 60s é só rede de segurança: o caminho normal é a revalidação on-demand
    // disparada pelo back-office (POST /api/revalidate) ao salvar o imóvel.
    { next: { revalidate: 60 } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Erro ao buscar imóvel");
  return res.json();
}

export async function getTags(): Promise<Tag[]> {
  const res = await fetchGetWithRetry(
    `${API_URL}/tags/publico`,
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getBairros(): Promise<string[]> {
  // Bairros mudam ~nunca (depende de um novo imóvel em região inédita).
  // 1 dia de cache reduz pressão sem prejudicar discoverability. A tag
  // "bairros" permite revalidação on-demand: ao salvar um imóvel, o back-office
  // purga esta lista na hora, senão um bairro inédito (ex.: Laranjeiras) só
  // apareceria no filtro após o cache de 1 dia expirar.
  const res = await fetchGetWithRetry(
    `${API_URL}/imoveis/publico/bairros`,
    { next: { revalidate: 86400, tags: ["bairros"] } },
  );
  if (!res.ok) return [];
  return res.json();
}

// ── Ficha de visita (assinatura pública por token) ───────────────────────────

export interface FichaPublica {
  status: "pendente" | "assinada" | "cancelada" | "expirada";
  visitante_nome: string;
  imovel_codigo?: string | null;
  imovel_endereco?: string | null;
  imovel_bairro?: string | null;
  imovel_cidade?: string | null;
  imovel_valor?: number | null;
  proprietario_nome?: string | null;
  corretor_nome?: string | null;
  corretor_creci?: string | null;
  clausula_texto: string;
  prazo_meses: number;
}

export type FichaErro = "nao_encontrada" | "indisponivel" | "erro";

/** Busca a ficha para assinatura. Lança o status como string em caso de erro
 * para a página distinguir 404 (link inválido) de 410 (já assinada/expirada). */
export async function getFichaPublica(token: string): Promise<FichaPublica> {
  const res = await fetchWithTimeout(
    `${API_URL}/fichas-visita/assinar/${encodeURIComponent(token)}`,
    { cache: "no-store" },
    TIMEOUT_GET_MS,
  );
  if (res.status === 404) throw new Error("nao_encontrada");
  if (res.status === 410) throw new Error("indisponivel");
  if (!res.ok) throw new Error("erro");
  return res.json();
}

export async function assinarFicha(
  token: string,
  body: { aceite: boolean; cpf: string; assinatura_png?: string | null; geo?: string | null },
): Promise<FichaPublica> {
  const res = await fetchWithTimeout(
    `${API_URL}/fichas-visita/assinar/${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    TIMEOUT_POST_MS,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? "Não foi possível assinar.");
  }
  return res.json();
}

export function fichaPdfUrl(token: string): string {
  return `${API_URL}/fichas-visita/assinar/${encodeURIComponent(token)}/pdf`;
}

// ── Autorização de intermediação (assinatura pública por token) ───────────────

export interface AutorizacaoPublica {
  status: "pendente" | "parcial" | "assinada" | "cancelada" | "expirada";
  /** Quem assina por ESTE link (cada proprietário tem o seu).
   *  Campos ausentes quando a API antiga ainda está no ar (skew de deploy). */
  signatario_nome?: string;
  ja_assinou?: boolean;
  signatarios?: { nome: string; assinou: boolean }[];
  proprietario_nome: string;
  imovel_codigo?: string | null;
  imovel_endereco?: string | null;
  imovel_bairro?: string | null;
  imovel_cidade?: string | null;
  tipo_negocio: "venda" | "locacao" | "ambos";
  valor_autorizado?: number | null;
  exclusiva: boolean;
  comissao_venda_pct?: number | null;
  comissao_locacao_desc?: string | null;
  prazo_dias: number;
  clausula_texto: string;
}

export async function getAutorizacaoPublica(token: string): Promise<AutorizacaoPublica> {
  const res = await fetchWithTimeout(
    `${API_URL}/autorizacoes/assinar/${encodeURIComponent(token)}`,
    { cache: "no-store" },
    TIMEOUT_GET_MS,
  );
  if (res.status === 404) throw new Error("nao_encontrada");
  if (res.status === 410) throw new Error("indisponivel");
  if (!res.ok) throw new Error("erro");
  return res.json();
}

export async function assinarAutorizacao(
  token: string,
  body: { aceite: boolean; cpf: string; assinatura_png?: string | null; geo?: string | null },
): Promise<AutorizacaoPublica> {
  const res = await fetchWithTimeout(
    `${API_URL}/autorizacoes/assinar/${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    TIMEOUT_POST_MS,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? "Não foi possível assinar.");
  }
  return res.json();
}

export function autorizacaoPdfUrl(token: string): string {
  return `${API_URL}/autorizacoes/assinar/${encodeURIComponent(token)}/pdf`;
}

export async function enviarContato(body: {
  nome: string;
  email: string;
  telefone: string;
  mensagem: string;
}): Promise<void> {
  const res = await fetchWithTimeout(
    `${API_URL}/contato`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    TIMEOUT_POST_MS,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? "Erro ao enviar mensagem");
  }
}
