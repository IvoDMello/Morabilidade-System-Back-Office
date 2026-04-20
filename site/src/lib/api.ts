import type { ImovelCard, Imovel, Tag, FiltrosParams } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ListResponse<T> {
  data: T[];
  total: number;
}

export async function getImoveisDisponiveis(
  params: FiltrosParams = {}
): Promise<ListResponse<ImovelCard>> {
  const url = new URL(`${API_URL}/imoveis/publico/disponiveis`);
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!res.ok) throw new Error("Erro ao buscar imóveis");

  const data: ImovelCard[] = await res.json();
  const total = Number(res.headers.get("x-total-count") ?? data.length);
  return { data, total };
}

export async function getImovel(codigo: string): Promise<Imovel | null> {
  const res = await fetch(`${API_URL}/imoveis/publico/${codigo}`, {
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Erro ao buscar imóvel");
  return res.json();
}

export async function getTags(): Promise<Tag[]> {
  const res = await fetch(`${API_URL}/tags/publico`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function enviarContato(body: {
  nome: string;
  email: string;
  telefone: string;
  mensagem: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/contato`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? "Erro ao enviar mensagem");
  }
}
