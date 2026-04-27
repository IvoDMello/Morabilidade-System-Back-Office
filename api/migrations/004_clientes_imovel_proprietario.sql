-- ============================================================
-- Morabilidade — Migration 004
-- Adiciona o campo `imovel_codigo` à tabela `clientes`.
-- Usado quando `tipo_cliente = 'proprietario'` para registrar o
-- código do imóvel do qual o cliente é proprietário.
-- O campo é texto (não FK) porque o imóvel pode ainda não ter
-- sido cadastrado no sistema no momento do cadastro do cliente.
-- Execute este script no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS imovel_codigo TEXT;

COMMENT ON COLUMN clientes.imovel_codigo IS 'Código do imóvel do proprietário (ex: IMO-00001). Opcional — preenchido apenas quando tipo_cliente = ''proprietario''.';
