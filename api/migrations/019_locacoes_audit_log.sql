-- Migration 019: Trilha de auditoria para o módulo de Administração de Locações.
-- ⚠️ PENDENTE DE EXECUÇÃO no Supabase, rodar no SQL Editor antes de usar a auditoria.
--
-- Motivação: contratos de locação envolvem valores recorrentes, taxas e
-- demonstrativos enviados ao locatário. Quando algo é alterado ou removido
-- (status, aluguel, pagamento marcado como pago, reajuste aplicado, anexo
-- deletado) precisamos saber QUEM, QUANDO e O QUE mudou, sem depender do
-- log de aplicação (que não é persistido).
--
-- A tabela é append-only do ponto de vista da aplicação, não há endpoint
-- de UPDATE ou DELETE. Consulta direta no Supabase (ou via futura página
-- /admin/auditoria-locacoes).

CREATE TABLE IF NOT EXISTS locacao_audit_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      timestamptz NOT NULL DEFAULT now(),

    -- Quem fez (snapshot do usuário no momento da ação).
    user_id         uuid REFERENCES usuarios(id) ON DELETE SET NULL,
    user_email      text,
    user_perfil     text,

    -- O que mudou.
    acao            text NOT NULL CHECK (acao IN ('insert', 'update', 'delete')),
    entidade        text NOT NULL CHECK (entidade IN ('contrato', 'pagamento', 'reajuste', 'anexo')),
    entidade_id     uuid NOT NULL,

    -- Sempre referencia o contrato pai para facilitar filtragem.
    contrato_id     uuid REFERENCES contratos_locacao(id) ON DELETE SET NULL,

    -- Estado antes (NULL em insert) e depois (NULL em delete).
    payload_antes   jsonb,
    payload_depois  jsonb
);

CREATE INDEX IF NOT EXISTS idx_locacao_audit_contrato
    ON locacao_audit_log(contrato_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_locacao_audit_user
    ON locacao_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_locacao_audit_entidade
    ON locacao_audit_log(entidade, entidade_id);

COMMENT ON TABLE locacao_audit_log IS
    'Trilha de auditoria append-only para CRUD de contratos, pagamentos, reajustes e anexos.';
