-- ============================================================
-- Morabilidade — Migration 002
-- Adiciona campos `instagram` e `pais` à tabela `clientes`.
-- O campo `pais` é preenchido apenas quando `estado = 'EX'` (exterior).
-- Execute este script no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS pais      TEXT;

COMMENT ON COLUMN clientes.instagram IS '@perfil ou link do Instagram (opcional)';
COMMENT ON COLUMN clientes.pais      IS 'País do cliente — preenchido quando estado = ''EX'' (exterior)';
