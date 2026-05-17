// ── Usuários ──────────────────────────────────────────────────────────────────

// admin: acesso total (escrita + leitura). corretor: somente leitura.
export type PerfilAcesso = "admin" | "corretor";

export interface User {
  id: string;
  nome_completo: string;
  email: string;
  perfil: PerfilAcesso;
  telefone?: string;
  foto_url?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// ── Imóveis ───────────────────────────────────────────────────────────────────

export type TipoNegocio = "venda" | "locacao" | "ambos";
export type Disponibilidade = "disponivel" | "reservado" | "vendido_locado";
export type TipoImovel =
  | "casa" | "casa_vila" | "casa_condominio"
  | "apartamento" | "terreno" | "sala"
  | "galpao" | "loja" | "cobertura" | "kitnet" | "outro";
export type Mobiliado = "sim" | "nao" | "semi-mobiliado";
export type CondicaoImovel = "em_construcao" | "na_planta" | "novo" | "usado";

export interface Foto {
  id: string;
  url: string;
  ordem: number;
}

export interface Tag {
  id: string;
  nome: string;
  cor?: string;
  created_at: string;
}

export interface Imovel {
  id: string;
  codigo: string;
  tipo_negocio: TipoNegocio;
  disponibilidade: Disponibilidade;
  cidade: string;
  bairro: string;
  logradouro: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  tipo_imovel: TipoImovel;
  dormitorios?: number;
  suites?: number;
  banheiros?: number;
  vagas_garagem?: number;
  mobiliado?: Mobiliado;
  condicao: CondicaoImovel;
  andar?: number;
  area_total?: number;
  area_util?: number;
  valor_venda?: number;
  valor_locacao?: number;
  iptu_mensal?: number;
  condominio_mensal?: number;
  descricao?: string;
  observacoes_internas?: string;
  video_url?: string;
  corretor_id?: string;
  destaque_ordem?: number | null;
  fotos: Foto[];
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface ImovelListOut {
  id: string;
  codigo: string;
  tipo_negocio: TipoNegocio;
  disponibilidade: Disponibilidade;
  cidade: string;
  bairro: string;
  logradouro: string;
  numero?: string;
  tipo_imovel: TipoImovel;
  dormitorios?: number;
  suites?: number;
  banheiros?: number;
  vagas_garagem?: number;
  area_util?: number;
  valor_venda?: number;
  valor_locacao?: number;
  condominio_mensal?: number;
  iptu_mensal?: number;
  foto_capa?: string;
  tags: { id: string; nome: string; cor?: string }[];
  destaque_ordem?: number | null;
  proprietario?: { nome_completo: string; telefone: string } | null;
  created_at: string;
}

// ── Clientes ──────────────────────────────────────────────────────────────────

export type StatusCliente = "ativo" | "em_negociacao" | "inativo" | "concluido";
export type TipoCliente = "comprador" | "locatario" | "proprietario" | "investidor";
export type OrigemLead =
  | "site" | "indicacao" | "ligacao" | "whatsapp"
  | "instagram" | "facebook" | "outro";

export interface Cliente {
  id: string;
  nome_completo: string;
  email?: string;
  telefone: string;
  cpf_cnpj?: string;
  data_nascimento?: string;
  telefone_secundario?: string;
  instagram?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  profissao_empresa?: string;
  origem_lead?: OrigemLead;
  corretor_id?: string;
  status?: StatusCliente;
  tipo_cliente?: TipoCliente;
  renda_aproximada?: number;
  como_conheceu?: string;
  observacoes?: string;
  imovel_codigo?: string;
  tags?: { id: string; nome: string; cor?: string }[];
  created_at: string;
  updated_at: string;
}

// ── Locações ──────────────────────────────────────────────────────────────────

export type StatusLocacao = "ativo" | "em_encerramento" | "rescindido" | "encerrado";
export type StatusPagamento = "pendente" | "pago" | "atrasado" | "parcial";

export interface ParteResumo {
  id: string;
  nome?: string;
  codigo?: string;
  endereco?: string;
}

export interface ContratoLocacao {
  id: string;
  imovel_id: string;
  proprietario_id: string;
  locatario_id: string;
  data_inicio: string;
  data_fim: string;
  dia_vencimento: number;
  aluguel_mensal: number;
  condominio_mensal: number;
  incluir_condominio_cobranca: boolean;
  fundo_reserva: number;
  fundo_obra: number;
  incluir_fundo_obra_cobranca: boolean;
  iptu_anual: number;
  incluir_iptu_cobranca: boolean;
  seguro_incendio_anual: number;
  incluir_seguro_incendio_cobranca: boolean;
  numero_iptu?: string;
  dados_cobranca_pix?: string;
  observacoes_demonstrativo?: string;
  taxa_administracao_pct: number;
  status: StatusLocacao;
  motivo_rescisao?: string;
  data_rescisao?: string;
  created_at: string;
  updated_at: string;
  imovel?: ParteResumo;
  proprietario?: ParteResumo;
  locatario?: ParteResumo;
}

export interface ReajusteLocacao {
  id: string;
  contrato_id: string;
  data_aplicacao: string;
  percentual: number;
  aluguel_anterior: number;
  aluguel_novo: number;
  indice_referencia?: string;
  observacoes?: string;
  applied_by?: string;
  created_at: string;
}

export interface RepasseItem {
  contrato_id: string;
  imovel_codigo?: string;
  imovel_endereco?: string;
  pagamento_id: string;
  valor_pago: number;
  taxa_administracao_pct: number;
  valor_taxa: number;
  valor_repasse: number;
}

export interface RepasseProprietario {
  proprietario_id: string;
  nome: string;
  email?: string;
  total_recebido: number;
  total_taxa: number;
  total_repasse: number;
  itens: RepasseItem[];
}

export interface RepasseResumo {
  mes: string;
  proprietarios: RepasseProprietario[];
  total_recebido: number;
  total_taxa: number;
  total_repasse: number;
}

export interface ContratoLocacaoListItem {
  id: string;
  status: StatusLocacao;
  data_inicio: string;
  data_fim: string;
  dia_vencimento: number;
  aluguel_mensal: number;
  imovel?: ParteResumo;
  proprietario?: ParteResumo;
  locatario?: ParteResumo;
  created_at: string;
}

export interface PagamentoLocacao {
  id: string;
  contrato_id: string;
  mes_referencia: string;
  valor_devido: number;
  valor_pago?: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: StatusPagamento;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface AnaliseLocacao {
  kpis: {
    contratos_ativos: number;
    em_encerramento: number;
    rescindidos_no_ano: number;
    inadimplencia_pct: number;
    valor_em_aberto: number;
  };
  ano: number;
  receita_prevista_por_mes: Record<string, number>;
  receita_realizada_por_mes: Record<string, number>;
  contratos_ativos_por_bairro: Record<string, number>;
}

export type TipoAnexoLocacao = "contrato" | "aditivo" | "vistoria" | "outro";

export interface AnexoLocacao {
  id: string;
  contrato_id: string;
  tipo: TipoAnexoLocacao;
  nome_arquivo: string;
  firebase_path: string;
  tamanho_bytes?: number;
  mime_type?: string;
  uploaded_by?: string;
  url?: string;
  created_at: string;
}
