-- Migration 030: Trilha de auditoria geral de ações de escrita.
-- ⚠️ PENDENTE DE EXECUÇÃO no Supabase — rodar no SQL Editor antes de usar.
--
-- Motivação: o perfil 'corretor' passou a ter as mesmas permissões de
-- alteração do 'admin'. Para manter rastreabilidade de QUEM alterou
-- (especialmente distinguir ações de corretor das de admin), toda
-- requisição de escrita (POST/PUT/PATCH/DELETE) que passa pelo gate de
-- permissão grava uma linha aqui.
--
-- Não há UI consumindo esta tabela — é append-only e destinada a
-- consultas pontuais direto no Supabase. Ex.:
--   SELECT created_at, user_email, user_perfil, metodo, path
--   FROM acao_audit_log
--   WHERE user_perfil = 'corretor'
--   ORDER BY created_at DESC;

CREATE TABLE IF NOT EXISTS acao_audit_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      timestamptz NOT NULL DEFAULT now(),

    -- Quem fez (snapshot do usuário no momento da ação).
    user_id         uuid REFERENCES usuarios(id) ON DELETE SET NULL,
    user_email      text,
    user_perfil     text,

    -- O que foi requisitado.
    metodo          text NOT NULL,
    path            text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_acao_audit_user
    ON acao_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_acao_audit_perfil
    ON acao_audit_log(user_perfil, created_at DESC);

COMMENT ON TABLE acao_audit_log IS
    'Trilha append-only de ações de escrita (POST/PUT/PATCH/DELETE) por usuário, para consultas pontuais.';
