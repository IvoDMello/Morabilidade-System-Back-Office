-- 052: busca por palavra na descrição do imóvel (filtro do painel web)
--
-- Mesma receita das migrations 009/011 para bairro e cidade: coluna gerada
-- sem acentos e em minúsculas + índice trigram, para o ILIKE '%palavra%'
-- não varrer a tabela inteira e para "area" achar "área".
-- Depende de: migration 009 (unaccent_immutable) e 011 (pg_trgm).

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS descricao_norm text
    GENERATED ALWAYS AS (unaccent_immutable(lower(descricao))) STORED;

COMMENT ON COLUMN imoveis.descricao_norm IS
  'descricao normalizada (sem acentos, minúsculas) para busca accent-insensitive.';

CREATE INDEX IF NOT EXISTS idx_imoveis_descricao_norm_trgm
    ON imoveis USING gin(descricao_norm gin_trgm_ops);
