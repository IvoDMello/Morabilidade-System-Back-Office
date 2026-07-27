/**
 * Cliente server-to-server para a API principal do back-office (FastAPI).
 *
 * Liga o CRM ao domínio real: um código de imóvel citado numa conversa deixa de
 * ser um título digitado à mão e passa a resolver o imóvel de verdade (título,
 * bairro, status, preço) do catálogo do sistema.
 *
 * A autenticação é o mesmo padrão das captações: header X-Internal-Token
 * validado por `require_admin_or_internal` na API. O token só é lido no servidor
 * (process.env sem prefixo NEXT_PUBLIC) — este módulo só é importado por server
 * actions e services, nunca por componente de client.
 *
 * Tudo aqui é best-effort: sem as variáveis de ambiente, com a API fora do ar
 * ou com 404, retornamos null e o CRM segue funcionando com o que tem (o código
 * ainda é vinculado, só sem os dados ricos). Nunca lançamos para não derrubar
 * uma server action ou um job por causa de uma indisponibilidade da API.
 */

const REQUEST_TIMEOUT_MS = 5000;

/** Subconjunto do ClienteListOut da API que o CRM usa para o vínculo. */
export interface ClienteResumo {
  id: string;
  codigo: string | null;
  nome: string | null;
}

/** Subconjunto do ImovelOut da API que o CRM realmente usa. */
export interface ImovelResumo {
  codigo: string;
  titulo: string | null;
  bairro: string | null;
  cidade: string | null;
  tipoNegocio: string | null;
  disponibilidade: string | null;
  valorVenda: number | null;
  valorLocacao: number | null;
}

function getConfig(): { apiUrl: string; token: string } | null {
  const apiUrl = process.env.BACKOFFICE_API_URL;
  const token = process.env.BACKOFFICE_INTERNAL_TOKEN;
  if (!apiUrl || !token) return null;
  return { apiUrl: apiUrl.replace(/\/$/, ""), token };
}

/** True se a integração com a API principal está configurada. */
export function isBackofficeConfigured(): boolean {
  return getConfig() !== null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Busca um imóvel por código na API principal. Retorna null se não configurado,
 * não encontrado (404) ou em qualquer falha de rede/timeout — sempre best-effort.
 */
export async function fetchImovelByCodigo(codigo: string): Promise<ImovelResumo | null> {
  const config = getConfig();
  const code = codigo.trim();
  if (!config || !code) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${config.apiUrl}/imoveis/interno/${encodeURIComponent(code)}`,
      {
        headers: { "X-Internal-Token": config.token },
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      codigo: String(data.codigo ?? code),
      titulo: (data.titulo as string) ?? null,
      bairro: (data.bairro as string) ?? null,
      cidade: (data.cidade as string) ?? null,
      tipoNegocio: (data.tipo_negocio as string) ?? null,
      disponibilidade: (data.disponibilidade as string) ?? null,
      valorVenda: toNumber(data.valor_venda),
      valorLocacao: toNumber(data.valor_locacao),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Casa um telefone com um cliente existente do sistema (busca por dígitos na API
 * principal). Retorna null se não configurado, sem correspondência ou em falha —
 * sempre best-effort. O telefone deve ir só com dígitos (o wa_id do contato).
 */
export async function fetchClienteByTelefone(telefone: string): Promise<ClienteResumo | null> {
  const config = getConfig();
  const tel = telefone.replace(/\D/g, "");
  if (!config || tel.length < 10) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${config.apiUrl}/clientes/interno/por-telefone/${encodeURIComponent(tel)}`,
      {
        headers: { "X-Internal-Token": config.token },
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    // A API responde 200 com corpo `null` quando nada bate.
    const data = (await res.json()) as Record<string, unknown> | null;
    if (!data || !data.id) return null;
    return {
      id: String(data.id),
      codigo: (data.codigo as string) ?? null,
      nome: (data.nome_completo as string) ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve vários códigos de uma vez (em paralelo), retornando um mapa
 * código → imóvel só com os que foram encontrados. Best-effort: se a integração
 * não estiver configurada, retorna mapa vazio sem nem tentar. Usado para
 * enriquecer a lista de imóveis vinculados a um contato com dados ao vivo.
 */
export async function fetchImoveisByCodigos(
  codigos: string[],
): Promise<Record<string, ImovelResumo>> {
  if (!isBackofficeConfigured()) return {};
  const unicos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  const resultados = await Promise.all(unicos.map((c) => fetchImovelByCodigo(c)));

  const mapa: Record<string, ImovelResumo> = {};
  resultados.forEach((imovel) => {
    if (imovel) mapa[imovel.codigo] = imovel;
  });
  return mapa;
}
