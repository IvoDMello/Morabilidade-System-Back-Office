-- ============================================================
-- Morabilidade — Migration 003
-- Torna o campo `email` opcional em `clientes`.
-- Muitos contatos chegam por WhatsApp/Instagram sem e-mail.
-- Execute este script no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE clientes
  ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN clientes.email IS 'E-mail do cliente (opcional)';
