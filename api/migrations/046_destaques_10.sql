-- ============================================================
-- Morabilidade — Migration 046
-- Amplia o carrossel de destaques da home de 5 para 10 posições.
--
-- O CHECK original (migration 008) foi criado inline, então o
-- Postgres nomeou automaticamente como imoveis_destaque_ordem_check.
-- O índice UNIQUE parcial permanece o mesmo — a lógica de "empurrar"
-- posições no backend atualiza linha a linha (da maior para a menor)
-- justamente para nunca colidir com ele.
-- ============================================================

ALTER TABLE imoveis
  DROP CONSTRAINT IF EXISTS imoveis_destaque_ordem_check;

ALTER TABLE imoveis
  ADD CONSTRAINT imoveis_destaque_ordem_check
  CHECK (destaque_ordem IS NULL OR (destaque_ordem >= 1 AND destaque_ordem <= 10));

COMMENT ON COLUMN imoveis.destaque_ordem IS
  'Posição do imóvel no carrossel de destaques da home (1-10). NULL = não destacado.';
