// ── Usuários ──────────────────────────────────────────────────────────────────

export type PerfilAcesso = "admin" | "administrativo";

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
  | "casa" | "apartamento" | "terreno" | "sala"
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
  video_url?: string;
  corretor_id?: string;
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
  tipo_imovel: TipoImovel;
  dormitorios?: number;
  area_util?: number;
  valor_venda?: number;
  valor_locacao?: number;
  foto_capa?: string;
  tags: { id: string; nome: string; cor?: string }[];
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
  email: string;
  telefone: string;
  cpf_cnpj?: string;
  data_nascimento?: string;
  telefone_secundario?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  profissao_empresa?: string;
  origem_lead?: OrigemLead;
  corretor_id?: string;
  status?: StatusCliente;
  tipo_cliente?: TipoCliente;
  renda_aproximada?: number;
  como_conheceu?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}
