-- 038_autorizacao_signatarios.sql
-- Múltiplos proprietários assinando a mesma Autorização de Intermediação
-- (casal, herdeiros, condôminos). Cada signatário recebe o PRÓPRIO link de
-- assinatura, com trilha de auditoria individual (IP, hora, geo, traço).
--
-- A autorização (migration 035) só passa a 'assinada' quando TODOS os
-- signatários assinarem; enquanto parte assinou, fica 'parcial'. Os campos
-- proprietario_* da tabela-mãe continuam sendo o snapshot do signatário
-- principal (ordem 1) para listagens; o token da tabela-mãe é o mesmo do
-- signatário 1 (links antigos continuam funcionando).

CREATE TABLE IF NOT EXISTS autorizacao_signatarios (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    autorizacao_id           uuid NOT NULL
                                 REFERENCES autorizacoes_intermediacao(id) ON DELETE CASCADE,
    ordem                    integer NOT NULL DEFAULT 1,

    nome                     text NOT NULL,
    cpf                      text,
    telefone                 text,
    email                    text,

    -- Link individual de assinatura (expiração controlada pela tabela-mãe).
    token                    text NOT NULL UNIQUE,

    status                   text NOT NULL DEFAULT 'pendente'
                                 CHECK (status IN ('pendente', 'assinada')),

    -- Trilha de auditoria individual.
    assinada_em              timestamptz,
    assinante_ip             text,
    assinante_user_agent     text,
    assinante_geo            text,
    assinante_assinatura_png text,
    assinante_cpf_confirmado text,

    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_autorizacao_signatarios_autorizacao
    ON autorizacao_signatarios (autorizacao_id, ordem);

-- Estado intermediário: parte dos signatários já assinou.
ALTER TABLE autorizacoes_intermediacao
    DROP CONSTRAINT IF EXISTS autorizacoes_intermediacao_status_check;
ALTER TABLE autorizacoes_intermediacao
    ADD CONSTRAINT autorizacoes_intermediacao_status_check
    CHECK (status IN ('pendente', 'parcial', 'assinada', 'cancelada', 'expirada'));

-- Backfill: cada autorização existente vira 1 signatário (o proprietário),
-- reaproveitando o token, nenhum link já enviado quebra. Idempotente.
INSERT INTO autorizacao_signatarios (
    autorizacao_id, ordem, nome, cpf, telefone, email, token, status,
    assinada_em, assinante_ip, assinante_user_agent, assinante_geo,
    assinante_assinatura_png, assinante_cpf_confirmado
)
SELECT
    a.id, 1, a.proprietario_nome, a.proprietario_cpf, a.proprietario_telefone,
    a.proprietario_email, a.token,
    CASE WHEN a.status = 'assinada' THEN 'assinada' ELSE 'pendente' END,
    a.assinada_em, a.assinante_ip, a.assinante_user_agent, a.assinante_geo,
    a.assinante_assinatura_png, a.assinante_cpf_confirmado
FROM autorizacoes_intermediacao a
WHERE NOT EXISTS (
    SELECT 1 FROM autorizacao_signatarios s WHERE s.autorizacao_id = a.id
);

COMMENT ON TABLE autorizacao_signatarios IS
    'Signatários (proprietários) de uma autorização de intermediação. Um link de assinatura e uma trilha de auditoria por pessoa; a autorização só fica assinada quando todos assinarem.';
