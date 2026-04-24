export type TipoNegocio = "venda" | "locacao" | "ambos";
export type Disponibilidade = "disponivel" | "reservado" | "vendido_locado";
export type TipoImovel =
  | "casa" | "apartamento" | "terreno" | "sala"
  | "galpao" | "loja" | "cobertura" | "kitnet" | "outro";
export type Mobiliado = "sim" | "nao" | "semi-mobiliado";
export type CondicaoImovel = "em_construcao" | "na_planta" | "novo" | "usado";

export interface Tag {
  id: string;
  nome: string;
  cor?: string;
}

export interface Foto {
  id: string;
  url: string;
  ordem: number;
}

export interface ImovelCard {
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
  tags: Tag[];
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
  fotos: Foto[];
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface FiltrosParams {
  tipo_negocio?: string;
  cidade?: string;
  bairro?: string;
  tipo_imovel?: string;
  dormitorios_min?: string;
  preco_min?: string;
  preco_max?: string;
  condicao?: string;
  mobiliado?: string;
  page?: string;
  page_size?: string;
}
