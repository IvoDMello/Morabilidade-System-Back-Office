import type { ContactCategory } from "@/constants/contact-categories";
import type { ContactStatus } from "@/constants/contact-status";
import type { ID } from "./common";

/**
 * O que o cliente procura — espelho de `public.cliente_preferencias` do
 * sistema principal (1 linha por cliente). Nomes em camelCase; a conversão
 * mora em services/oportunidades.service.ts.
 */
export interface PreferenciaBusca {
  clienteId: string;
  tipoNegocio: string | null;
  tipoImovel: string | null;
  cidade: string | null;
  bairros: string[];
  valorMin: number | null;
  valorMax: number | null;
  dormitoriosMin: number | null;
  vagasGaragemMin: number | null;
  observacoes: string | null;
  /** `manual` = alguém preencheu; `ficha_visita` = inferida das visitas assinadas. */
  origem: string;
  atualizadaEm: string | null;
}

/** O que o corretor edita no formulário da aba (sem os campos derivados). */
export type PreferenciaInput = Omit<
  PreferenciaBusca,
  "clienteId" | "origem" | "atualizadaEm"
>;

/** Imóvel disponível do catálogo, no subconjunto que a aba usa. */
export interface ImovelDisponivel {
  id: string;
  codigo: string;
  titulo: string | null;
  cidade: string;
  bairro: string;
  tipoImovel: string;
  tipoNegocio: string;
  andar: number | null;
  valorVenda: number | null;
  valorLocacao: number | null;
  dormitorios: number | null;
  vagasGaragem: number | null;
  fotoCapa: string | null;
}

export type StatusCriterio = "ok" | "fora" | "na";

/** Um item do que o cliente pediu, confrontado com o imóvel. */
export interface CriterioMatch {
  chave: "negocio" | "tipo" | "cidade" | "bairro" | "dormitorios" | "vagas" | "valor";
  rotulo: string;
  /** O que o cliente pediu, em texto curto ("≥ 2 dorm.", "Ipanema"). */
  pedido: string;
  status: StatusCriterio;
}

/** Um imóvel já confrontado com a preferência de um cliente. */
export interface ImovelCompativel extends ImovelDisponivel {
  criterios: CriterioMatch[];
  /** Quantos critérios o cliente definiu (0 = preferência vazia). */
  definidos: number;
  /** Quantos desses o imóvel atende. */
  atendidos: number;
  /** Atende TODOS os critérios definidos — o mesmo recorte do painel web. */
  compativel: boolean;
  /** Falta exatamente um critério: o que dá assunto para uma conversa. */
  quase: boolean;
  /** Valor relevante para este par (locação ou venda), já escolhido. */
  valor: number | null;
  /** Já foi citado nesta conversa/vinculado ao contato — não repetir. */
  jaEnviado: boolean;
}

/** Estado da janela de 24h da Meta para conversar em texto livre. */
export interface JanelaResposta {
  aberta: boolean;
  /** Quando fecha (ISO); null quando o cliente nunca escreveu. */
  fechaEm: string | null;
}

/** Uma linha da aba: o contato, o que ele procura e o que temos para ele. */
export interface OportunidadeDoContato {
  contactId: ID;
  nome: string;
  telefone: string;
  categoria: ContactCategory;
  status: ContactStatus;
  clienteId: string | null;
  clienteCodigo: string | null;
  preferencia: PreferenciaBusca | null;
  /** Compatíveis primeiro, depois os "quase", cada grupo do mais recente. */
  imoveis: ImovelCompativel[];
  compativeis: number;
  janela: JanelaResposta;
  /** Códigos que o contato já demonstrou interesse (veio do site, citou no chat). */
  codigosDeInteresse: string[];
}

/** Resultado da tela inteira, já pronto para render. */
export interface PainelOportunidades {
  itens: OportunidadeDoContato[];
  /** Imóveis disponíveis no catálogo — denominador honesto do que a aba viu. */
  totalImoveis: number;
  /** Contatos ativos que ainda não têm perfil de busca preenchido. */
  semPerfil: number;
  /** False quando falta BACKOFFICE/Supabase: a tela explica em vez de mentir zero. */
  catalogoDisponivel: boolean;
}
