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

export async function getImoveisDisponiveis(
  params: FiltrosParams = {}
): Promise<ListResponse<ImovelCard>> {
  const url = new URL(`${API_URL}/imoveis/publico/disponiveis`);
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });

  const res = await fetchWithTimeout(
    url.toString(),
    { next: { revalidate: 60 } },
    TIMEOUT_GET_MS,
  );
  if (!res.ok) throw new Error("Erro ao buscar imóveis");

  const data: ImovelCard[] = await res.json();
  const total = Number(res.headers.get("x-total-count") ?? data.length);
  return { data, total };
}

export async function getImoveisDestaques(): Promise<ImovelCard[]> {
  const res = await fetchWithTimeout(
    `${API_URL}/imoveis/publico/destaques`,
    { next: { revalidate: 60 } },
    TIMEOUT_GET_MS,
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getImovel(codigo: string): Promise<Imovel | null> {
  const res = await fetchWithTimeout(
    `${API_URL}/imoveis/publico/${codigo}`,
    { next: { revalidate: 300 } },
    TIMEOUT_GET_MS,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Erro ao buscar imóvel");
  return res.json();
}

export async function getTags(): Promise<Tag[]> {
  const res = await fetchWithTimeout(
    `${API_URL}/tags/publico`,
    { next: { revalidate: 3600 } },
    TIMEOUT_GET_MS,
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getBairros(): Promise<string[]> {
  const res = await fetchWithTimeout(
    `${API_URL}/imoveis/publico/bairros`,
    { next: { revalidate: 3600 } },
    TIMEOUT_GET_MS,
  );
  if (!res.ok) return [];
  return res.json();
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
