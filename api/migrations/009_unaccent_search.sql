-- ============================================================
-- Morabilidade — Migration 009
-- Busca de imóveis insensível a acentos em bairro e cidade.
--
-- unaccent() é STABLE (não IMMUTABLE), o que impede uso direto
-- em colunas geradas. Solução padrão: wrapper declarado IMMUTABLE.
-- As colunas _norm são preenchidas automaticamente pelo Postgres
-- e mantidas atualizadas a cada INSERT/UPDATE.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Wrapper IMMUTABLE necessário para colunas geradas.
CREATE OR REPLACE FUNCTION unaccent_immutable(text)
  RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT unaccent($1); $$;

-- Colunas geradas: bairro e cidade sem acentos, em minúsculas.
ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS bairro_norm text
    GENERATED ALWAYS AS (unaccent_immutable(lower(bairro))) STORED;

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS cidade_norm text
    GENERATED ALWAYS AS (unaccent_immutable(lower(cidade))) STORED;

COMMENT ON COLUMN imoveis.bairro_norm IS
  'bairro normalizado (sem acentos, minúsculas) para busca accent-insensitive.';
COMMENT ON COLUMN imoveis.cidade_norm IS
  'cidade normalizada (sem acentos, minúsculas) para busca accent-insensitive.';
