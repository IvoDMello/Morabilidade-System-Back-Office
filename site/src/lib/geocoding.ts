export interface Coordenadas {
  lat: number;
  lng: number;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Morabilidade-Site/1.0 (contato@morabilidade.com)";
// Nominatim é externo e fora do nosso controle. Sem timeout, uma lentidão lá
// segura o SSR, foi o padrão que amplificou a queda de 19/05.
const NOMINATIM_TIMEOUT_MS = 4000;

export async function geocodificarEndereco(
  logradouro: string | undefined,
  bairro: string,
  cidade: string,
): Promise<Coordenadas | null> {
  const query = [logradouro, bairro, cidade, "Brasil"].filter(Boolean).join(", ");
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}