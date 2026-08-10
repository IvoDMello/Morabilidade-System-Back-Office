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
  /** UUID do imóvel — necessário para criar uma ficha de visita. */
  id: string | null;
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
      id: data.id ? String(data.id) : null,
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

export interface UpsertClienteInput {
  telefone: string;
  nome: string;
  /** Canal por onde o lead apareceu. Padrão da API é `whatsapp`; passamos
   * `site` quando a primeira mensagem trouxe o código de um imóvel — assinatura
   * do botão do site público. */
  origemLead?: "whatsapp" | "site" | "indicacao" | "instagram" | "outro" | null;
  tipoCliente?: "comprador" | "locatario" | "proprietario" | "investidor" | null;
  observacoes?: string | null;
}

export interface ClienteUpsertResultado extends ClienteResumo {
  /** True quando este contato acabou de entrar na base do sistema. */
  criado: boolean;
}

/**
 * Encontra ou cria o cliente correspondente a um telefone na API principal.
 *
 * É a ponte que faltava: até aqui o CRM só sabia CONSULTAR clientes, então um
 * lead que chegava pelo WhatsApp ficava preso no schema do chat — fora dos
 * relatórios, do matching e da ficha de visita.
 *
 * Best-effort como o resto do módulo: sem integração configurada, com a API
 * fora do ar ou com recusa, devolve null e o CRM segue funcionando sem o
 * vínculo. Criar cliente é enriquecimento, não pode ser caminho crítico.
 */
export async function upsertClienteByTelefone(
  input: UpsertClienteInput,
): Promise<ClienteUpsertResultado | null> {
  const config = getConfig();
  const tel = input.telefone.replace(/\D/g, "");
  const nome = input.nome.trim();
  if (!config || tel.length < 10 || !nome) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${config.apiUrl}/clientes/interno/upsert-por-telefone`, {
      method: "POST",
      headers: {
        "X-Internal-Token": config.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        telefone: tel,
        nome_completo: nome,
        origem_lead: input.origemLead ?? "whatsapp",
        tipo_cliente: input.tipoCliente ?? null,
        observacoes: input.observacoes ?? null,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    if (!data?.id) return null;
    return {
      id: String(data.id),
      codigo: (data.codigo as string) ?? null,
      nome: (data.nome_completo as string) ?? null,
      criado: Boolean(data.criado),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Ficha de visita recém-criada na API principal (o que o CRM usa do retorno). */
export interface FichaVisitaCriada {
  id: string;
  token: string;
  imovelCodigo: string | null;
  imovelEndereco: string | null;
}

export interface CriarFichaVisitaInput {
  imovelId: string;
  visitanteNome: string;
  visitanteTelefone?: string | null;
  clienteId?: string | null;
  /** Usuário da API principal responsável pela ficha (usuarios.id = auth.users.id). */
  corretorId: string;
}

/**
 * Cria uma ficha de visita na API principal (server-to-server, X-Internal-Token).
 * Diferente do resto deste módulo, LANÇA em caso de falha: quem chama é o cron
 * da ficha, que precisa distinguir "não deu para gerar" (vira pendência com o
 * motivo) de "gerou". A mensagem do erro é a que a API devolveu, porque
 * costuma ser acionável (ex.: corretor sem CRECI cadastrado).
 */
export async function criarFichaVisita(input: CriarFichaVisitaInput): Promise<FichaVisitaCriada> {
  const config = getConfig();
  if (!config) throw new Error("Integração com a API principal não configurada.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${config.apiUrl}/fichas-visita`, {
      method: "POST",
      headers: {
        "X-Internal-Token": config.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imovel_id: input.imovelId,
        visitante_nome: input.visitanteNome,
        visitante_telefone: input.visitanteTelefone ?? null,
        cliente_id: input.clienteId ?? null,
        corretor_id: input.corretorId,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const detalhe = await res
        .json()
        .then((b: { detail?: string }) => b?.detail)
        .catch(() => null);
      throw new Error(detalhe || `A API recusou a criação da ficha (HTTP ${res.status}).`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      id: String(data.id),
      token: String(data.token),
      imovelCodigo: (data.imovel_codigo as string) ?? null,
      imovelEndereco: (data.imovel_endereco as string) ?? null,
    };
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

/** Uma ficha de visita do cliente. `assinadaEm` nulo = emitida e pendente. */
export interface VisitaDoCliente {
  fichaId: string;
  imovelCodigo: string | null;
  imovelEndereco: string | null;
  imovelBairro: string | null;
  status: string;
  assinadaEm: string | null;
  createdAt: string | null;
}

export interface DocumentoDoImovel {
  tipo: string;
  nomeArquivo: string;
  createdAt: string | null;
}

export interface AutorizacaoDoImovel {
  autorizacaoId: string;
  tipoNegocio: string;
  status: string;
  assinadaEm: string | null;
}

export interface ImovelDoProprietario {
  imovelId: string;
  codigo: string | null;
  titulo: string | null;
  bairro: string | null;
  disponibilidade: string | null;
  documentos: DocumentoDoImovel[];
  autorizacao: AutorizacaoDoImovel | null;
}

/** Retrato do cliente no sistema principal: por onde passou e o que falta fechar. */
export interface DossieCliente {
  clienteId: string;
  codigo: string | null;
  nome: string | null;
  visitas: VisitaDoCliente[];
  imoveisProprietario: ImovelDoProprietario[];
}

/**
 * Dossiê do cliente na API principal: fichas de visita, imóveis de que é dono,
 * documentos anexados e autorização vigente.
 *
 * Best-effort como o resto do módulo — sem integração configurada, com a API
 * fora ou com um cliente que não existe mais, devolve null e a ficha do contato
 * simplesmente não mostra a seção. Um retrato incompleto do cliente nunca pode
 * derrubar a tela em que se está conversando com ele.
 */
export async function fetchDossieCliente(clienteId: string): Promise<DossieCliente | null> {
  const config = getConfig();
  const id = clienteId.trim();
  if (!config || !id) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${config.apiUrl}/clientes/interno/${encodeURIComponent(id)}/dossie`,
      {
        headers: { "X-Internal-Token": config.token },
        signal: controller.signal,
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown> | null;
    if (!data || !data.cliente_id) return null;

    const visitas = Array.isArray(data.visitas) ? data.visitas : [];
    const imoveis = Array.isArray(data.imoveis_proprietario) ? data.imoveis_proprietario : [];

    return {
      clienteId: String(data.cliente_id),
      codigo: (data.codigo as string) ?? null,
      nome: (data.nome_completo as string) ?? null,
      visitas: visitas.map((v) => {
        const visita = v as Record<string, unknown>;
        return {
          fichaId: String(visita.ficha_id),
          imovelCodigo: (visita.imovel_codigo as string) ?? null,
          imovelEndereco: (visita.imovel_endereco as string) ?? null,
          imovelBairro: (visita.imovel_bairro as string) ?? null,
          status: String(visita.status ?? "emitida"),
          assinadaEm: (visita.assinada_em as string) ?? null,
          createdAt: (visita.created_at as string) ?? null,
        };
      }),
      imoveisProprietario: imoveis.map((i) => {
        const imovel = i as Record<string, unknown>;
        const documentos = Array.isArray(imovel.documentos) ? imovel.documentos : [];
        const auth = imovel.autorizacao as Record<string, unknown> | null;
        return {
          imovelId: String(imovel.imovel_id),
          codigo: (imovel.codigo as string) ?? null,
          titulo: (imovel.titulo as string) ?? null,
          bairro: (imovel.bairro as string) ?? null,
          disponibilidade: (imovel.disponibilidade as string) ?? null,
          documentos: documentos.map((d) => {
            const doc = d as Record<string, unknown>;
            return {
              tipo: String(doc.tipo ?? "outro"),
              nomeArquivo: String(doc.nome_arquivo ?? ""),
              createdAt: (doc.created_at as string) ?? null,
            };
          }),
          autorizacao: !auth
            ? null
            : {
                autorizacaoId: String(auth.autorizacao_id),
                tipoNegocio: String(auth.tipo_negocio ?? "venda"),
                status: String(auth.status ?? "emitida"),
                assinadaEm: (auth.assinada_em as string) ?? null,
              },
        };
      }),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
