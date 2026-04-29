-- ============================================================
-- Morabilidade — Migration 005
-- Renomeia o perfil 'administrativo' para 'corretor' e ajusta o
-- CHECK constraint da tabela usuarios.
--
-- Modelo de permissões:
--   admin    → acesso total (escrita + leitura)
--   corretor → somente leitura
--
-- IMPORTANTE: a constraint é dropada ANTES do UPDATE para que o
-- novo valor 'corretor' não viole a restrição antiga durante a
-- migração. Esta migration é idempotente — pode rodar de novo
-- com segurança caso uma execução anterior tenha falhado no meio.
-- ============================================================

-- 1) Remove a constraint atual (não importa qual versão esteja ativa)
ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_perfil_check;

-- 2) Migrar dados existentes ('administrativo' → 'corretor')
UPDATE usuarios
SET perfil = 'corretor'
WHERE perfil = 'administrativo';

-- 3) Recriar a constraint com o novo conjunto de valores
ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_perfil_check
  CHECK (perfil IN ('admin', 'corretor'));

-- 4) Atualizar default
ALTER TABLE usuarios
  ALTER COLUMN perfil SET DEFAULT 'corretor';

COMMENT ON COLUMN usuarios.perfil IS 'admin (escrita+leitura) ou corretor (somente leitura)';
