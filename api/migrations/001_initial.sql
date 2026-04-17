-- ============================================================
-- Morabilidade — Migration Inicial
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Habilita extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sequência para código de imóveis (IMO-00001, IMO-00002, ...)
CREATE SEQUENCE IF NOT EXISTS imoveis_seq START 1;

-- Função auxiliar para obter próximo código de imóvel
CREATE OR REPLACE FUNCTION proxima_sequencia_imovel()
RETURNS INTEGER AS $$
  SELECT nextval('imoveis_seq')::INTEGER;
$$ LANGUAGE SQL;

-- ============================================================
-- TABELA: usuarios
-- Complementa o auth.users do Supabase Auth
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  perfil      TEXT NOT NULL CHECK (perfil IN ('admin', 'administrativo')) DEFAULT 'administrativo',
  telefone    TEXT,
  foto_url    TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TABELA: tags
-- Etiquetas configuráveis pelo admin
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome       TEXT NOT NULL UNIQUE,
  cor        TEXT,  -- ex: "#FF5733"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tags padrão
INSERT INTO tags (nome, cor) VALUES
  ('Destaque', '#F59E0B'),
  ('Novo', '#10B981'),
  ('Oportunidade', '#EF4444')
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- TABELA: imoveis
-- ============================================================
CREATE TABLE IF NOT EXISTS imoveis (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo              TEXT NOT NULL UNIQUE,
  tipo_negocio        TEXT NOT NULL CHECK (tipo_negocio IN ('venda', 'locacao', 'ambos')),
  disponibilidade     TEXT NOT NULL CHECK (disponibilidade IN ('disponivel', 'reservado', 'vendido_locado')) DEFAULT 'disponivel',
  cidade              TEXT NOT NULL,
  bairro              TEXT NOT NULL,
  logradouro          TEXT NOT NULL,
  numero              TEXT,
  complemento         TEXT,
  cep                 TEXT,
  tipo_imovel         TEXT NOT NULL CHECK (tipo_imovel IN ('casa', 'apartamento', 'terreno', 'sala', 'galpao', 'loja', 'cobertura', 'kitnet', 'outro')),
  dormitorios         SMALLINT,
  suites              SMALLINT,
  banheiros           SMALLINT,
  vagas_garagem       SMALLINT,
  mobiliado           TEXT CHECK (mobiliado IN ('sim', 'nao', 'semi-mobiliado')),
  condicao            TEXT NOT NULL CHECK (condicao IN ('em_construcao', 'na_planta', 'novo', 'usado')),
  andar               SMALLINT,
  area_total          NUMERIC(10, 2),
  area_util           NUMERIC(10, 2),
  valor_venda         NUMERIC(12, 2),
  valor_locacao       NUMERIC(10, 2),
  iptu_mensal         NUMERIC(8, 2),
  condominio_mensal   NUMERIC(8, 2),
  descricao           TEXT,
  video_url           TEXT,
  corretor_id         UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER imoveis_updated_at
  BEFORE UPDATE ON imoveis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Índices para filtros mais comuns
CREATE INDEX IF NOT EXISTS idx_imoveis_disponibilidade ON imoveis(disponibilidade);
CREATE INDEX IF NOT EXISTS idx_imoveis_tipo_negocio    ON imoveis(tipo_negocio);
CREATE INDEX IF NOT EXISTS idx_imoveis_cidade          ON imoveis(cidade);
CREATE INDEX IF NOT EXISTS idx_imoveis_tipo_imovel     ON imoveis(tipo_imovel);
CREATE INDEX IF NOT EXISTS idx_imoveis_codigo          ON imoveis(codigo);

-- ============================================================
-- TABELA: imovel_fotos
-- ============================================================
CREATE TABLE IF NOT EXISTS imovel_fotos (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imovel_id  UUID NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  ordem      SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imovel_fotos_imovel ON imovel_fotos(imovel_id);

-- ============================================================
-- TABELA: imovel_tags (junção N:N)
-- ============================================================
CREATE TABLE IF NOT EXISTS imovel_tags (
  imovel_id UUID NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE,
  tag_id    UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (imovel_id, tag_id)
);

-- ============================================================
-- TABELA: clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_completo       TEXT NOT NULL,
  email               TEXT NOT NULL,
  telefone            TEXT NOT NULL,
  cpf_cnpj            TEXT,
  data_nascimento     DATE,
  telefone_secundario TEXT,
  endereco            TEXT,
  cidade              TEXT,
  estado              CHAR(2),
  profissao_empresa   TEXT,
  origem_lead         TEXT CHECK (origem_lead IN ('site', 'indicacao', 'ligacao', 'whatsapp', 'instagram', 'facebook', 'outro')),
  corretor_id         UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  status              TEXT CHECK (status IN ('ativo', 'em_negociacao', 'inativo', 'concluido')),
  tipo_cliente        TEXT CHECK (tipo_cliente IN ('comprador', 'locatario', 'proprietario', 'investidor')),
  renda_aproximada    NUMERIC(12, 2),
  como_conheceu       TEXT,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_clientes_email  ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_status ON clientes(status);

-- ============================================================
-- RLS (Row Level Security)
-- Acesso via service_role key desabilita RLS — a API usa isso.
-- Para segurança adicional, habilite RLS e crie policies conforme necessário.
-- ============================================================
ALTER TABLE usuarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE imoveis     ENABLE ROW LEVEL SECURITY;
ALTER TABLE imovel_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE imovel_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags        ENABLE ROW LEVEL SECURITY;

-- Policy: service_role tem acesso total (usado pela API)
-- Usuários autenticados podem ler/escrever nas tabelas internas
CREATE POLICY "usuarios autenticados podem ler imoveis"
  ON imoveis FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "usuarios autenticados podem ler tags"
  ON tags FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE imoveis      IS 'Cadastro de imóveis — núcleo do sistema';
COMMENT ON TABLE clientes     IS 'Cadastro de clientes e leads';
COMMENT ON TABLE tags         IS 'Etiquetas configuráveis pelo admin (Destaque, Novo, etc.)';
COMMENT ON TABLE imovel_fotos IS 'Fotos armazenadas no Firebase Storage, referenciadas aqui';
COMMENT ON TABLE imovel_tags  IS 'Associação N:N entre imóveis e tags';
COMMENT ON TABLE usuarios     IS 'Perfis internos que complementam o auth.users do Supabase';
