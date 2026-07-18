-- ============================================================
-- Morabilidade: Migration 048
-- Estrutura o histórico de contato do cliente: cada nota ganha
-- um tipo de contato (canal). As notas antigas viram 'nota'
-- (texto livre, comportamento que sempre existiu).
-- ============================================================

ALTER TABLE cliente_notas
  ADD COLUMN IF NOT EXISTS tipo_contato TEXT NOT NULL DEFAULT 'nota'
    CHECK (tipo_contato IN ('nota', 'ligacao', 'whatsapp', 'email', 'visita', 'presencial'));

COMMENT ON COLUMN cliente_notas.tipo_contato IS
  'Canal da interação registrada: nota (texto livre), ligacao, whatsapp, email, visita ou presencial.';
