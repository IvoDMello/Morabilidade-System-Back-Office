-- ============================================================
-- Morabilidade — Migration 007
-- Tabela de preferências de imóvel por cliente.
--
-- Quando um imóvel novo entra que casa com a preferência de um
-- cliente, ele aparece na lista de "Oportunidades" do dashboard
-- e na ficha do cliente. O envio (WhatsApp/e-mail) é manual,
-- com link wa.me pré-preenchido.
--
-- Modelo simplificado: 1 preferência por cliente. Se evoluir para
-- múltiplas preferências, basta remover o UNIQUE em cliente_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS cliente_preferencias (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id      UUID NOT NULL UNIQUE REFERENCES clientes(id) ON DELETE CASCADE,
  tipo_negocio    TEXT CHECK (tipo_negocio IN ('venda', 'locacao', 'ambos')),
  tipo_imovel     TEXT CHECK (tipo_imovel IN ('casa','apartamento','terreno','sala','galpao','loja','cobertura','kitnet','outro')),
  cidade          TEXT,
  bairro          TEXT,
  valor_min       NUMERIC(12, 2),
  valor_max       NUMERIC(12, 2),
  dormitorios_min SMALLINT,
  observacoes     TEXT,
  ativa           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER cliente_preferencias_updated_at
  BEFORE UPDATE ON cliente_preferencias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cliente_preferencias_cliente   ON cliente_preferencias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_preferencias_ativa     ON cliente_preferencias(ativa);
CREATE INDEX IF NOT EXISTS idx_cliente_preferencias_bairro    ON cliente_preferencias(bairro);
CREATE INDEX IF NOT EXISTS idx_cliente_preferencias_tipo      ON cliente_preferencias(tipo_imovel);

ALTER TABLE cliente_preferencias ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE cliente_preferencias IS 'Critérios que o cliente busca; usados para gerar oportunidades de match com imóveis.';
