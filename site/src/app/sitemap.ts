import type { MetadataRoute } from "next";
import type { ImovelCard } from "@/types";

export const revalidate = 86400; // 24h

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://morabilidade.com.br";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const staticPages: MetadataRoute.Sitemap = [
  { url: SITE_URL,                    changeFrequency: "daily",   priority: 1.0 },
  { url: `${SITE_URL}/imoveis`,       changeFrequency: "daily",   priority: 0.9 },
  { url: `${SITE_URL}/sobre`,         changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/contato`,       changeFrequency: "monthly", priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(
      `${API_URL}/imoveis/publico/disponiveis?page_size=1000`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return staticPages;

    const imoveis: ImovelCard[] = await res.json();

    const imovelPages: MetadataRoute.Sitemap = imoveis.map((imovel) => ({
      url: `${SITE_URL}/imoveis/${imovel.codigo}`,
      lastModified: new Date(imovel.created_at),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    return [...staticPages, ...imovelPages];
  } catch {
    return staticPages;
  }
}
