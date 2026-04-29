-- ============================================================
-- Morabilidade — Migration 008
-- Destaques na home do site público.
--
-- Admin escolhe até 5 imóveis para aparecerem no carrossel da
-- home, definindo uma posição (1-5). A constraint UNIQUE garante
-- que cada posição só pode ser ocupada por 1 imóvel; o backend
-- libera automaticamente a posição antiga ao reatribuir.
-- ============================================================

ALTER TABLE imoveis
  ADD COLUMN IF NOT EXISTS destaque_ordem SMALLINT
  CHECK (destaque_ordem IS NULL OR (destaque_ordem >= 1 AND destaque_ordem <= 5));

-- UNIQUE parcial: ignora linhas com NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_imoveis_destaque_ordem_unico
  ON imoveis(destaque_ordem)
  WHERE destaque_ordem IS NOT NULL;

COMMENT ON COLUMN imoveis.destaque_ordem IS
  'Posição do imóvel no carrossel de destaques da home (1-5). NULL = não destacado.';
