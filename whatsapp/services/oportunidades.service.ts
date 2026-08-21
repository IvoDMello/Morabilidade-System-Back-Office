import { getSupabaseSistemaClient } from "@/lib/supabase/server";
import { mockStore } from "@/services/data/mock/store";
import { dataSource } from "./data";
import { getContacts } from "./contacts.service";
import { garantirClienteDoContato } from "./clientes.service";
import { avaliarImovel, foraDoRecorte, valorDoPar } from "@/lib/match-imovel";
import type { ContactStatus } from "@/constants/contact-status";
import type { ID } from "@/types/common";
import type {
  ImovelCompativel,
  ImovelDisponivel,
  JanelaResposta,
  OportunidadeDoContato,
  PainelOportunidades,
  PreferenciaBusca,
  PreferenciaInput,
} from "@/types/oportunidade";

/**
 * Aba de Oportunidades: cruza cada contato do WhatsApp com o catálogo de
 * imóveis do sistema principal e entrega a lista pronta para virar mensagem.
 *
 * O painel web já respondia "quais imóveis combinam com este cliente", mas
 * respondia longe de onde se fala com o cliente — e por isso a resposta não
 * virava contato. Aqui a mesma pergunta é respondida ao lado da conversa, com
 * o botão de enviar do lado.
 *
 * ── De onde vêm os dados ──────────────────────────────────────────────────
 * `imoveis` e `cliente_preferencias` vivem no schema `public` do MESMO
 * Supabase (é o banco da API principal) — ver getSupabaseSistemaClient(). O
 * cruzamento em si é puro e mora em lib/match-imovel.ts.
 *
 * Segue o mesmo `NEXT_PUBLIC_DATA_SOURCE` do resto do painel: em modo mock lê
 * de um catálogo em memória, sem exigir credencial.
 */
const USA_SUPABASE = process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase";

/** Janela da Meta para responder em texto livre, contada da última mensagem do cliente. */
const JANELA_HORAS = 24;

/**
 * Quem não entra na aba: contato encerrado (ganho ou perdido) e bloqueado.
 *
 * A aba é uma fila de trabalho, não um relatório. Cliente que já comprou ou que
 * disse não continua no CRM, mas mandar imóvel para ele é justamente o tipo de
 * mensagem que faz um número ser marcado como spam.
 */
const STATUS_FORA_DA_ABA: ContactStatus[] = ["finalizado", "perdido"];

/** Teto de imóveis mostrados por contato — a lista é para escolher, não para navegar. */
const IMOVEIS_POR_CONTATO = 8;

// ── Leitura do catálogo ──────────────────────────────────────────────────────

const COLUNAS_IMOVEL =
  "id, codigo, titulo, cidade, bairro, tipo_imovel, tipo_negocio, andar, " +
  "valor_venda, valor_locacao, dormitorios, vagas_garagem, imovel_fotos(url, ordem)";

const COLUNAS_PREFERENCIA =
  "cliente_id, tipo_negocio, tipo_imovel, cidade, bairros, valor_min, valor_max, " +
  "dormitorios_min, vagas_garagem_min, observacoes, origem, updated_at";

function numeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

function mapImovel(row: Record<string, unknown>): ImovelDisponivel {
  const fotos = Array.isArray(row.imovel_fotos)
    ? [...(row.imovel_fotos as { url: string; ordem?: number }[])].sort(
        (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0),
      )
    : [];
  return {
    id: String(row.id),
    codigo: String(row.codigo ?? ""),
    titulo: (row.titulo as string) ?? null,
    cidade: String(row.cidade ?? ""),
    bairro: String(row.bairro ?? ""),
    tipoImovel: String(row.tipo_imovel ?? ""),
    tipoNegocio: String(row.tipo_negocio ?? ""),
    andar: numeroOuNulo(row.andar),
    valorVenda: numeroOuNulo(row.valor_venda),
    valorLocacao: numeroOuNulo(row.valor_locacao),
    dormitorios: numeroOuNulo(row.dormitorios),
    vagasGaragem: numeroOuNulo(row.vagas_garagem),
    fotoCapa: fotos[0]?.url ?? null,
  };
}

function mapPreferencia(row: Record<string, unknown>): PreferenciaBusca {
  return {
    clienteId: String(row.cliente_id),
    tipoNegocio: (row.tipo_negocio as string) ?? null,
    tipoImovel: (row.tipo_imovel as string) ?? null,
    cidade: (row.cidade as string) ?? null,
    bairros: Array.isArray(row.bairros) ? (row.bairros as string[]) : [],
    valorMin: numeroOuNulo(row.valor_min),
    valorMax: numeroOuNulo(row.valor_max),
    dormitoriosMin: numeroOuNulo(row.dormitorios_min),
    vagasGaragemMin: numeroOuNulo(row.vagas_garagem_min),
    observacoes: (row.observacoes as string) ?? null,
    origem: String(row.origem ?? "manual"),
    atualizadaEm: (row.updated_at as string) ?? null,
  };
}

/** Todo o catálogo disponível. Base pequena (centenas), lida de uma vez só. */
async function listarImoveisDisponiveis(): Promise<ImovelDisponivel[]> {
  if (!USA_SUPABASE) return [...mockStore.imoveisSistema];

  const supabase = getSupabaseSistemaClient();
  const { data, error } = await supabase
    .from("imoveis")
    .select(COLUNAS_IMOVEL)
    .eq("disponibilidade", "disponivel");
  if (error) throw error;
  return (data ?? []).map((row) => mapImovel(row as unknown as Record<string, unknown>));
}

/** Preferências ativas dos clientes informados, em uma consulta só. */
async function listarPreferencias(clienteIds: string[]): Promise<Map<string, PreferenciaBusca>> {
  const mapa = new Map<string, PreferenciaBusca>();
  if (clienteIds.length === 0) return mapa;

  if (!USA_SUPABASE) {
    for (const pref of mockStore.preferencias) {
      if (clienteIds.includes(pref.clienteId)) mapa.set(pref.clienteId, pref);
    }
    return mapa;
  }

  const supabase = getSupabaseSistemaClient();
  const { data, error } = await supabase
    .from("cliente_preferencias")
    .select(COLUNAS_PREFERENCIA)
    .eq("ativa", true)
    .in("cliente_id", clienteIds);
  if (error) throw error;

  for (const row of data ?? []) {
    const pref = mapPreferencia(row as unknown as Record<string, unknown>);
    mapa.set(pref.clienteId, pref);
  }
  return mapa;
}

// ── Montagem do painel ───────────────────────────────────────────────────────

/** Estado da janela de 24h a partir da última mensagem recebida do cliente. */
export function calcularJanela(lastInboundAt: string | null, agora = new Date()): JanelaResposta {
  if (!lastInboundAt) return { aberta: false, fechaEm: null };
  const fecha = new Date(new Date(lastInboundAt).getTime() + JANELA_HORAS * 60 * 60 * 1000);
  return { aberta: fecha.getTime() > agora.getTime(), fechaEm: fecha.toISOString() };
}

/**
 * Confronta o catálogo inteiro com uma preferência e devolve o que vale mostrar.
 *
 * Ordem: compatível antes de "quase"; dentro de cada grupo, quem atende mais
 * critérios primeiro e, no empate, o mais barato — que é o que costuma ser a
 * conversa mais fácil de começar.
 */
export function ranquearImoveis(
  imoveis: ImovelDisponivel[],
  pref: PreferenciaBusca,
  codigosDeInteresse: string[] = [],
  limite = IMOVEIS_POR_CONTATO,
): ImovelCompativel[] {
  const jaVistos = new Set(codigosDeInteresse.map((c) => c.toUpperCase()));

  const avaliados: ImovelCompativel[] = [];
  for (const imovel of imoveis) {
    // O piso de R$ 2M é recorte da imobiliária, não pedido do cliente: some da
    // lista em vez de aparecer como um critério reprovado que ninguém pediu.
    if (foraDoRecorte(imovel, pref)) continue;

    const veredito = avaliarImovel(imovel, pref);
    if (!veredito.compativel && !veredito.quase) continue;

    avaliados.push({
      ...imovel,
      criterios: veredito.criterios,
      definidos: veredito.definidos,
      atendidos: veredito.atendidos,
      compativel: veredito.compativel,
      quase: veredito.quase,
      valor: valorDoPar(imovel, pref),
      jaEnviado: jaVistos.has(imovel.codigo.toUpperCase()),
    });
  }

  avaliados.sort((a, b) => {
    if (a.compativel !== b.compativel) return a.compativel ? -1 : 1;
    if (a.atendidos !== b.atendidos) return b.atendidos - a.atendidos;
    return (a.valor ?? Infinity) - (b.valor ?? Infinity);
  });

  return avaliados.slice(0, limite);
}

/**
 * A aba inteira: contatos ativos, o que cada um procura e o que temos para ele.
 *
 * Duas consultas ao catálogo no total (imóveis + preferências), independente de
 * quantos contatos existam — o cruzamento acontece em memória. É o oposto do
 * painel web, que dispara um GET /matches por cliente e leva minutos com a base
 * cheia.
 */
export async function getPainelOportunidades(): Promise<PainelOportunidades> {
  const [contatos, conversas] = await Promise.all([
    getContacts({ sortBy: "updatedAt" }),
    dataSource.whatsapp.listConversations(),
  ]);

  const ativos = contatos.filter(
    (c) => !c.isBlocked && !STATUS_FORA_DA_ABA.includes(c.status),
  );

  let imoveis: ImovelDisponivel[] = [];
  let preferencias = new Map<string, PreferenciaBusca>();
  let catalogoDisponivel = true;
  try {
    const clienteIds = ativos.map((c) => c.clienteId).filter((id): id is string => Boolean(id));
    [imoveis, preferencias] = await Promise.all([
      listarImoveisDisponiveis(),
      listarPreferencias([...new Set(clienteIds)]),
    ]);
  } catch (erro) {
    // Sem catálogo a aba ainda serve para ver e preencher o perfil de busca —
    // e a tela diz que o catálogo não respondeu, em vez de exibir "0 imóveis"
    // como se o estoque estivesse vazio.
    console.error("[oportunidades] catálogo indisponível:", erro);
    catalogoDisponivel = false;
  }

  const janelaPorContato = new Map(conversas.map((c) => [c.contactId, c.lastInboundAt]));
  const agora = new Date();

  // Imóveis que cada contato já demonstrou interesse: veio pelo botão do site
  // com o código dentro, ou citou o código no chat (ver services/lead-origem).
  const vinculosPorContato = await dataSource.properties
    .listByContacts(ativos.map((c) => c.id))
    .catch((erro) => {
      console.error("[oportunidades] vínculos de imóvel indisponíveis:", erro);
      return new Map<ID, { code: string }[]>();
    });

  const itens: OportunidadeDoContato[] = [];
  for (const contato of ativos) {
    const pref = contato.clienteId ? preferencias.get(contato.clienteId) ?? null : null;
    const codigosDeInteresse = (vinculosPorContato.get(contato.id) ?? []).map((v) => v.code);

    const lista = pref ? ranquearImoveis(imoveis, pref, codigosDeInteresse) : [];

    itens.push({
      contactId: contato.id,
      nome: contato.name,
      telefone: contato.phone,
      categoria: contato.category,
      status: contato.status,
      clienteId: contato.clienteId,
      clienteCodigo: contato.clienteCodigo,
      preferencia: pref,
      imoveis: lista,
      compativeis: lista.filter((i) => i.compativel).length,
      janela: calcularJanela(janelaPorContato.get(contato.id) ?? null, agora),
      codigosDeInteresse,
    });
  }

  // Quem tem oportunidade primeiro; depois quem tem "quase"; por último quem
  // ainda não tem perfil de busca — que é trabalho de cadastro, não de contato.
  itens.sort((a, b) => {
    if (a.compativeis !== b.compativeis) return b.compativeis - a.compativeis;
    if (a.imoveis.length !== b.imoveis.length) return b.imoveis.length - a.imoveis.length;
    return Number(Boolean(b.preferencia)) - Number(Boolean(a.preferencia));
  });

  return {
    itens,
    totalImoveis: imoveis.length,
    semPerfil: itens.filter((i) => !i.preferencia).length,
    catalogoDisponivel,
  };
}

// ── Escrita da preferência ───────────────────────────────────────────────────

export interface SalvarPreferenciaResultado {
  ok: boolean;
  erro?: string;
  /** True quando o contato virou cliente do sistema agora, para salvar o perfil. */
  clienteCriado?: boolean;
}

function limpar(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim();
  return t || null;
}

/**
 * Grava o que o cliente procura, em `public.cliente_preferencias`.
 *
 * Um contato do WhatsApp só tem perfil de busca se for um cliente do sistema —
 * a tabela é chaveada por `cliente_id`. Preencher o perfil É um evento de
 * compromisso (alguém sentou e disse o que a pessoa quer), então este é um dos
 * momentos em que vale promover o contato a cadastro; ver clientes.service.ts
 * para as regras que impedem isso de sujar a base (nome que é só telefone, por
 * exemplo, não vira cliente).
 *
 * `origem` vai como 'manual' pelo mesmo motivo que no back-office: preferência
 * escrita por gente congela a inferência automática das fichas de visita.
 */
export async function salvarPreferencia(
  contactId: ID,
  input: PreferenciaInput,
): Promise<SalvarPreferenciaResultado> {
  const contato = await dataSource.contacts.getById(contactId);
  if (!contato) return { ok: false, erro: "Contato não encontrado." };

  if (
    input.valorMin !== null &&
    input.valorMax !== null &&
    input.valorMin > input.valorMax
  ) {
    return { ok: false, erro: "O valor mínimo não pode ser maior que o máximo." };
  }

  let clienteId = contato.clienteId;
  let clienteCriado = false;
  if (!clienteId) {
    const vinculo = await garantirClienteDoContato(contato);
    if (!vinculo) {
      return {
        ok: false,
        erro:
          "Este contato ainda não é um cliente do sistema. Dê um nome de verdade a ele " +
          "(hoje está só com o telefone) e tente de novo.",
      };
    }
    clienteId = vinculo.clienteId;
    clienteCriado = vinculo.criado;
  }

  const registro: PreferenciaBusca = {
    clienteId,
    tipoNegocio: limpar(input.tipoNegocio),
    tipoImovel: limpar(input.tipoImovel),
    cidade: limpar(input.cidade),
    bairros: input.bairros.map((b) => b.trim()).filter(Boolean),
    valorMin: input.valorMin,
    valorMax: input.valorMax,
    dormitoriosMin: input.dormitoriosMin,
    vagasGaragemMin: input.vagasGaragemMin,
    observacoes: limpar(input.observacoes),
    origem: "manual",
    atualizadaEm: new Date().toISOString(),
  };

  if (!USA_SUPABASE) {
    const i = mockStore.preferencias.findIndex((p) => p.clienteId === clienteId);
    if (i >= 0) mockStore.preferencias[i] = registro;
    else mockStore.preferencias.push(registro);
    return { ok: true, clienteCriado };
  }

  const supabase = getSupabaseSistemaClient();
  const payload = {
    cliente_id: clienteId,
    tipo_negocio: registro.tipoNegocio,
    tipo_imovel: registro.tipoImovel,
    cidade: registro.cidade,
    bairros: registro.bairros,
    valor_min: registro.valorMin,
    valor_max: registro.valorMax,
    dormitorios_min: registro.dormitoriosMin,
    vagas_garagem_min: registro.vagasGaragemMin,
    observacoes: registro.observacoes,
    ativa: true,
    origem: "manual",
  };

  // `cliente_id` é UNIQUE (migration 007 da API), então o upsert por conflito
  // faz o mesmo que o back-office faz com SELECT + INSERT/UPDATE, sem a corrida.
  const { error } = await supabase
    .from("cliente_preferencias")
    .upsert(payload, { onConflict: "cliente_id" });

  if (error) {
    console.error("[oportunidades] falha ao salvar preferência:", error);
    return { ok: false, erro: "Não foi possível salvar o perfil de busca. Tente de novo." };
  }
  return { ok: true, clienteCriado };
}

// ── Registro do envio ────────────────────────────────────────────────────────

/**
 * Marca no CRM os imóveis que acabaram de ser oferecidos ao contato.
 *
 * Reusa o vínculo contato-imóvel que já existe (`relacao: interesse`), em vez
 * de inventar um registro novo: é o mesmo fato que o rastro da mensagem grava
 * quando o cliente chega pelo site citando um código. Com isso a ficha do
 * contato mostra o que foi oferecido, a timeline ganha o evento, e a própria
 * aba passa a marcar aquele imóvel como "já enviado" — que é o que impede
 * mandar a mesma cobertura três vezes para a mesma pessoa.
 *
 * Best-effort inteiro: a mensagem já saiu, e nenhuma falha de bookkeeping pode
 * virar erro na cara de quem acabou de enviar com sucesso.
 */
export async function registrarImoveisEnviados(
  contactId: ID,
  imoveis: { codigo: string; titulo: string | null }[],
): Promise<void> {
  for (const imovel of imoveis) {
    try {
      const local = await dataSource.properties.create({
        code: imovel.codigo,
        title: imovel.titulo,
      });
      const jaVinculados = await dataSource.properties.listByContact(contactId);
      const novo = !jaVinculados.some(
        (v) => v.code.toUpperCase() === imovel.codigo.toUpperCase(),
      );

      await dataSource.properties.addToContact(contactId, local.id, "interesse", "interesse");
      if (novo) {
        await dataSource.events.create({
          contactId,
          type: "property_linked",
          summary: `Imóvel ${imovel.codigo} enviado pela aba de Oportunidades`,
        });
      }
    } catch (erro) {
      console.error("[oportunidades] envio registrado sem vínculo de imóvel:", erro);
    }
  }
}
