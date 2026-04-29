-- ============================================================
-- Morabilidade — Migration 006
-- Tabela de junção cliente_tags (mesma estrutura de imovel_tags).
-- Tags reutilizadas das já existentes na tabela `tags`.
-- ============================================================

CREATE TABLE IF NOT EXISTS cliente_tags (
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (cliente_id, tag_id)
);

ALTER TABLE cliente_tags ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE cliente_tags IS 'Associação N:N entre clientes e tags.';
